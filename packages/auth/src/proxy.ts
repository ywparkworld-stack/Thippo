import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@thippo/db/server";
import { decideAccess } from "./access";
import { checkAccessGate, readAccessGateConfig } from "./access-gate";
import type { AppName } from "./apps";
import { loadSession } from "./session";

/**
 * 各アプリの proxy.ts（旧 middleware）から使う。SPEC §3.1 の「middleware でロールを確認する」に当たる。
 * - Supabase のセッションを更新して cookie に書き戻す
 * - そのアプリに入れるロールかを確かめ、合わなければセッションを破棄してログイン画面へ戻す
 */
export function createAuthProxy(app: AppName) {
  return async function proxy(request: NextRequest): Promise<NextResponse> {
    if (app === "admin") {
      // 運営管理は、ログインより前に前段のアクセス制限を確かめる（SPEC §3.2）
      const gate = await checkAccessGate(request.headers, readAccessGateConfig());
      if (!gate.ok) {
        console.warn(`[admin access gate] denied: ${gate.reason}`);
        return new NextResponse("Forbidden", {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    let response = NextResponse.next({ request });
    const supabase = createSupabaseServerClient({
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    });

    const session = await loadSession(supabase);
    const { pathname, search } = request.nextUrl;
    const decision = decideAccess(app, pathname, search, session);
    if (decision.type === "allow") return withPrivateCache(response, session !== null);

    if (decision.signOut) await supabase.auth.signOut({ scope: "local" });
    const redirect = NextResponse.redirect(new URL(decision.to, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return withPrivateCache(redirect, true);
  };
}

/** ログイン中のページは共有キャッシュに載せない */
function withPrivateCache(response: NextResponse, signedIn: boolean): NextResponse {
  if (signedIn) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** 静的ファイルなどを除いたすべてのパスで proxy を動かす */
export const AUTH_PROXY_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
];
