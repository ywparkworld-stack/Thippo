/**
 * ログイン後の戻り先。オープンリダイレクトを防ぐため、同じサイトの絶対パスだけを受け付ける。
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2000) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // 制御文字やバックスラッシュを含むものは拒否する（ブラウザによっては // と解釈される）
  if ([...next].some((ch) => ch.charCodeAt(0) < 0x20 || ch === "\\")) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginUrl(next?: string, error?: LoginError): string {
  const params = new URLSearchParams();
  if (next && next !== "/") params.set("next", next);
  if (error) params.set("error", error);
  const qs = params.toString();
  return qs ? `/login?${qs}` : "/login";
}

export type LoginError = "forbidden" | "suspended" | "session_expired" | "link_invalid";
