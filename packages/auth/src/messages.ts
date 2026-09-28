import type { LoginError } from "./redirect";

export const LOGIN_ERROR_MESSAGES: Record<LoginError, string> = {
  forbidden: "このアカウントではこのサイトにログインできません。",
  suspended: "このアカウントは停止されています。お問い合わせください。",
  session_expired: "セッションの有効期限が切れました。もう一度ログインしてください。",
  link_invalid: "リンクが無効か、有効期限が切れています。もう一度お試しください。",
};

export function loginErrorMessage(code: unknown): string | null {
  return typeof code === "string" && code in LOGIN_ERROR_MESSAGES
    ? LOGIN_ERROR_MESSAGES[code as LoginError]
    : null;
}

/** Supabase Auth のエラーを利用者向けの文言にする。詳細（アカウントの有無など）は伝えない。 */
export function authErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}): string {
  switch (error.code) {
    case "invalid_credentials":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "email_not_confirmed":
      return "メールアドレスの確認が済んでいません。届いたメールのリンクを開いてください。";
    case "weak_password":
      return "パスワードが簡単すぎます。英字と数字を含む10文字以上にしてください。";
    case "same_password":
      return "今と同じパスワードは設定できません。";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return RATE_LIMITED_MESSAGE;
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "確認コードが正しくないか、有効期限が切れています。";
    default:
      return "処理に失敗しました。時間をおいてもう一度お試しください。";
  }
}

export const RATE_LIMITED_MESSAGE =
  "試行回数が多すぎます。しばらく時間をおいてからお試しください。";
