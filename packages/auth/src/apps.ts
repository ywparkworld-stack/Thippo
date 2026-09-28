/** 3つのアプリと、それぞれに入れるロール（SPEC §1, §3.1）。 */
export type AppName = "guest" | "host" | "admin";
export type UserRole = "guest" | "host" | "admin";
export type AccountStatus = "active" | "suspended";

export const APP_ROLE: Record<AppName, UserRole> = {
  guest: "guest",
  host: "host",
  admin: "admin",
};

export const LOGIN_PATH = "/login";
export const MFA_ENROLL_PATH = "/mfa/enroll";
export const MFA_VERIFY_PATH = "/mfa/verify";

/**
 * ログインなしで開けるパス。前方一致（"/login" は "/login" と "/login/..." に一致）。
 * 利用者サイトは公開ページが多いため、逆にログインが必要なパスを列挙する。
 */
const AUTH_PAGES = ["/login", "/auth", "/password/forgot"];

export const PUBLIC_PATHS: Record<Exclude<AppName, "guest">, readonly string[]> = {
  host: AUTH_PAGES,
  admin: AUTH_PAGES,
};

/** 利用者サイトでログインが必要なパス */
export const GUEST_PROTECTED_PATHS = ["/mypage", "/checkout", "/password/reset"] as const;

/** 利用者サイトで、未ログインのときだけ開くページ（ログイン済みならトップへ） */
export const GUEST_ONLY_WHEN_SIGNED_OUT = ["/login", "/signup"] as const;

export function matchesPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
