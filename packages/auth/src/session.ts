import type { createSupabaseServerClient } from "@thippo/db/server";
import type { SessionInfo } from "./access";

export type ServerSupabase = ReturnType<typeof createSupabaseServerClient>;

/**
 * JWT を検証してログイン中の利用者を取り出し、profiles からロールと状態を読む。
 * ロールや停止状態は JWT に入れず毎回 DB から読む（停止をすぐに反映するため）。
 */
export async function loadSession(supabase: ServerSupabase): Promise<SessionInfo | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  const userId = claims.sub;
  const aal = claims.aal === "aal2" ? "aal2" : "aal1";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  let hasVerifiedFactor = aal === "aal2";
  if (!hasVerifiedFactor && profile?.role === "admin") {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    hasVerifiedFactor = level?.nextLevel === "aal2";
  }

  return {
    userId,
    role: profile?.role ?? null,
    status: profile?.status ?? null,
    deleted: profile ? profile.deleted_at !== null : true,
    aal,
    hasVerifiedFactor,
  };
}
