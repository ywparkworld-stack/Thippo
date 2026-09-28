import {
  APP_ROLE,
  GUEST_ONLY_WHEN_SIGNED_OUT,
  GUEST_PROTECTED_PATHS,
  LOGIN_PATH,
  MFA_ENROLL_PATH,
  MFA_VERIFY_PATH,
  PUBLIC_PATHS,
  matchesPath,
  type AccountStatus,
  type AppName,
  type UserRole,
} from "./apps";
import { loginUrl, safeNextPath } from "./redirect";

export interface SessionInfo {
  userId: string;
  /** profiles の行がない（削除済みなど）場合は null */
  role: UserRole | null;
  status: AccountStatus | null;
  deleted: boolean;
  /** JWT の aal */
  aal: "aal1" | "aal2";
  /** 確認済みの2段階認証（TOTP）があるか */
  hasVerifiedFactor: boolean;
}

export type AccessDecision =
  | { type: "allow" }
  /** リダイレクトする。signOut が true ならセッションを破棄してから */
  | { type: "redirect"; to: string; signOut?: boolean };

/**
 * そのアプリのそのパスを開いてよいかを決める（proxy とサーバー側の両方で使う）。
 * - ロールが合わない・停止中のアカウントはセッションを破棄してログイン画面へ（SPEC §3.1）
 * - 運営管理は 2 段階認証（aal2）が済むまで、2 段階認証の画面以外は開けない（SPEC §3.2）
 */
export function decideAccess(
  app: AppName,
  pathname: string,
  search: string,
  session: SessionInfo | null,
): AccessDecision {
  const here = safeNextPath(`${pathname}${search}`);
  const isLoginPage = matchesPath(pathname, LOGIN_PATH);
  const isMfaPage = matchesPath(pathname, "/mfa");

  const requiresLogin =
    app === "guest"
      ? GUEST_PROTECTED_PATHS.some((p) => matchesPath(pathname, p))
      : !PUBLIC_PATHS[app].some((p) => matchesPath(pathname, p));

  if (!session) {
    if (requiresLogin) return { type: "redirect", to: loginUrl(here) };
    return { type: "allow" };
  }

  // ロールが合わない・停止中・退会済み → セッションを破棄してログイン画面へ
  if (session.deleted || session.role === null) {
    return { type: "redirect", to: loginUrl(undefined, "forbidden"), signOut: true };
  }
  if (session.role !== APP_ROLE[app]) {
    return { type: "redirect", to: loginUrl(undefined, "forbidden"), signOut: true };
  }
  if (session.status !== "active") {
    return { type: "redirect", to: loginUrl(undefined, "suspended"), signOut: true };
  }

  if (app === "admin") {
    if (session.aal !== "aal2") {
      const mfaPath = session.hasVerifiedFactor ? MFA_VERIFY_PATH : MFA_ENROLL_PATH;
      if (matchesPath(pathname, mfaPath)) return { type: "allow" };
      // /auth（メールのリンクの確認）だけは 2 段階認証の前でも通す
      if (matchesPath(pathname, "/auth")) return { type: "allow" };
      const next = isLoginPage || isMfaPage ? "/" : here;
      return {
        type: "redirect",
        to: next === "/" ? mfaPath : `${mfaPath}?next=${encodeURIComponent(next)}`,
      };
    }
    if (isMfaPage) return { type: "redirect", to: "/" };
  }

  // ログイン済みでログイン画面・会員登録画面を開いた → トップへ
  if (
    isLoginPage ||
    (app === "guest" && GUEST_ONLY_WHEN_SIGNED_OUT.some((p) => matchesPath(pathname, p)))
  ) {
    return { type: "redirect", to: "/" };
  }
  return { type: "allow" };
}
