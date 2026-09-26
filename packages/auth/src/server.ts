import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { RATE_LIMITS, type RateLimitAction } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { createSupabaseServerClient } from "@thippo/db/server";
import { APP_ROLE, MFA_ENROLL_PATH, MFA_VERIFY_PATH, type AppName } from "./apps";
import type { SessionInfo } from "./access";
import { loginUrl } from "./redirect";
import { loadSession, type ServerSupabase } from "./session";

export { loadSession, type ServerSupabase } from "./session";

/** Server Components・Server Actions・Route Handlers 用。ログイン中の利用者の権限で動く。 */
export async function createClient(): Promise<ServerSupabase> {
  const store = await cookies();
  return createSupabaseServerClient({
    getAll: () => store.getAll(),
    setAll: (list) => {
      try {
        for (const { name, value, options } of list) store.set(name, value, options);
      } catch {
        // Server Component からは cookie を書けない。セッションの更新は proxy が行う。
      }
    },
  });
}

export interface AppSession extends SessionInfo {
  supabase: ServerSupabase;
}

/**
 * そのアプリに入れる利用者でなければリダイレクトする。保護したい layout・page・Server Action の先頭で呼ぶ。
 * proxy でも同じ判定をしているが、proxy だけに頼らずサーバー側でも必ず確かめる。
 */
export async function requireAppSession(app: AppName, next?: string): Promise<AppSession> {
  const supabase = await createClient();
  const session = await loadSession(supabase);
  if (!session) redirect(loginUrl(next));
  if (session.deleted || session.role !== APP_ROLE[app]) redirect(loginUrl(undefined, "forbidden"));
  if (session.status !== "active") redirect(loginUrl(undefined, "suspended"));
  if (app === "admin" && session.aal !== "aal2") {
    redirect(session.hasVerifiedFactor ? MFA_VERIFY_PATH : MFA_ENROLL_PATH);
  }
  return { ...session, supabase };
}

/** リクエスト元の IP アドレス。Vercel は x-forwarded-for を上書きするため先頭の値を使う。 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}

async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * レート制限を 1 回分数える（SPEC §3.3、付録 D5）。IP 単位とアカウント単位の両方を数え、どちらかが上限を超えたら拒否。
 * アカウントのキー（メールアドレスなど）はハッシュにして保存する。
 */
export async function consumeRateLimit(
  action: RateLimitAction,
  account: string | null,
): Promise<RateLimitResult> {
  const rules = RATE_LIMITS[action];
  const ip = await clientIp();
  const checks: { key: string; limit: number; windowSeconds: number }[] = [];
  if (ip) checks.push({ key: `${action}:ip:${hashKey(ip)}`, ...rules.perIp });
  if (account)
    checks.push({ key: `${action}:acct:${hashKey(account.toLowerCase())}`, ...rules.perAccount });

  const service = createSupabaseServiceClient();
  let retryAfterSeconds = 0;
  for (const c of checks) {
    const { data, error } = await service.rpc("consume_rate_limit", {
      p_key: c.key,
      p_limit: c.limit,
      p_window_seconds: c.windowSeconds,
    });
    if (error) throw new Error(`rate limit check failed: ${error.message}`);
    const row = data?.[0];
    if (row && !row.allowed)
      retryAfterSeconds = Math.max(retryAfterSeconds, row.retry_after_seconds);
  }
  return retryAfterSeconds > 0 ? { ok: false, retryAfterSeconds } : { ok: true };
}

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

/**
 * 操作ログを記録する（SPEC §3.2）。ログイン・2段階認証・書類の閲覧など、アプリ側の操作に使う。
 * DB の状態を変える運営の操作は、DB 関数の中で private.write_audit_log を使い、同じトランザクションで記録する。
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const service = createSupabaseServiceClient();
  const { error } = await service.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    payload: { ...entry.payload, ip: await clientIp(), user_agent: await userAgent() },
  });
  if (error) throw new Error(`failed to write audit log: ${error.message}`);
}
