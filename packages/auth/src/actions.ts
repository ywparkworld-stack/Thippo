import "server-only";
import { redirect } from "next/navigation";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  totpCodeSchema,
} from "@thippo/core";
import { APP_ROLE, MFA_ENROLL_PATH, MFA_VERIFY_PATH, type AppName } from "./apps";
import type { FormState } from "./form-state";
import { authErrorMessage, LOGIN_ERROR_MESSAGES, RATE_LIMITED_MESSAGE } from "./messages";
import { loginUrl, safeNextPath } from "./redirect";
import {
  consumeRateLimit,
  createClient,
  loadSession,
  recordAudit,
  requireAppSession,
} from "./server";
import { appUrl } from "./urls";

/**
 * 認証の Server Action の中身。各アプリの "use server" ファイルから、アプリ名を固定して呼ぶ。
 * （アプリ名をクライアントから受け取らないため、bind などで渡さないこと）
 */

const formObject = (formData: FormData) =>
  Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<
    string,
    string
  >;

export async function signIn(app: AppName, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { email, password, next } = parsed.data;
  const values = { email };

  const limit = await consumeRateLimit("login", email);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (app === "admin") {
      await recordAudit({ actorId: null, action: "admin.login_failed", payload: { email } });
    }
    return { error: authErrorMessage(error ?? {}), values };
  }

  const session = await loadSession(supabase);
  if (!session || session.deleted || session.role !== APP_ROLE[app]) {
    await supabase.auth.signOut({ scope: "local" });
    if (app === "admin") {
      await recordAudit({
        actorId: data.user.id,
        action: "admin.login_denied",
        payload: { email },
      });
    }
    return { error: LOGIN_ERROR_MESSAGES.forbidden, values };
  }
  if (session.status !== "active") {
    await supabase.auth.signOut({ scope: "local" });
    return { error: LOGIN_ERROR_MESSAGES.suspended, values };
  }

  const dest = safeNextPath(next);
  if (app === "admin") {
    await recordAudit({
      actorId: session.userId,
      action: "admin.login",
      payload: { aal: session.aal },
    });
    const mfa = session.hasVerifiedFactor ? MFA_VERIFY_PATH : MFA_ENROLL_PATH;
    redirect(dest === "/" ? mfa : `${mfa}?next=${encodeURIComponent(dest)}`);
  }
  redirect(dest);
}

/** 利用者の会員登録（貸出主・運営のアカウントは招待または DB で作る） */
export async function signUpGuest(formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(formObject(formData));
  const raw = formObject(formData);
  const values = { email: raw.email ?? "", displayName: raw.displayName ?? "" };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { email, password, displayName, next } = parsed.data;

  const limit = await consumeRateLimit("signup", email);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl("guest"),
      data: { display_name: displayName, next: safeNextPath(next) },
    },
  });
  // 登録済みのメールアドレスでも同じ画面にする（アカウントの有無を知られないため）
  if (error && error.code !== "user_already_exists")
    return { error: authErrorMessage(error), values };
  redirect("/signup/check-email");
}

export async function requestPasswordReset(app: AppName, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { email } = parsed.data;

  const limit = await consumeRateLimit("passwordReset", email);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE, values: { email } };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl(app) });
  // 送信に失敗してもアカウントの有無は伝えない
  return {
    message:
      "ご登録のメールアドレスであれば、パスワード再設定のメールをお送りしました。メールのリンクから再設定してください。",
  };
}

export async function updatePassword(app: AppName, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireAppSession(app, "/password/reset");
  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };
  if (app === "admin") await recordAudit({ actorId: userId, action: "admin.password_changed" });
  redirect(app === "guest" ? "/mypage?password=updated" : "/?password=updated");
}

export async function signOut(app: AppName): Promise<void> {
  const supabase = await createClient();
  const session = await loadSession(supabase);
  await supabase.auth.signOut({ scope: "local" });
  if (app === "admin" && session)
    await recordAudit({ actorId: session.userId, action: "admin.logout" });
  redirect(loginUrl());
}

// ---------------------------------------------------------------------------
// 運営の2段階認証（TOTP）
// ---------------------------------------------------------------------------

async function requireAdminAal1() {
  const supabase = await createClient();
  const session = await loadSession(supabase);
  if (!session || session.deleted || session.role !== "admin" || session.status !== "active") {
    redirect(loginUrl(undefined, "forbidden"));
  }
  return { supabase, session };
}

export interface TotpEnrollment {
  factorId: string;
  /** QR コード（SVG の data URL） */
  qrCode: string;
  /** 手入力用の秘密鍵 */
  secret: string;
}

export async function startTotpEnrollment(): Promise<{
  enrollment?: TotpEnrollment;
  error?: string;
}> {
  const { supabase, session } = await requireAdminAal1();
  if (session.hasVerifiedFactor) redirect(MFA_VERIFY_PATH);

  // 途中でやめた（未確認の）登録を消してからやり直す
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `thippo-admin-${Date.now()}`,
    issuer: "thippo 運営管理",
  });
  if (error || !data) return { error: authErrorMessage(error ?? {}) };
  return { enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyTotp(
  mode: "enroll" | "verify",
  formData: FormData,
): Promise<FormState> {
  const { supabase, session } = await requireAdminAal1();
  // 設定済みの人が新しい端末を追加するには、既存の端末での確認（aal2）が必要
  if (mode === "enroll" && session.hasVerifiedFactor) redirect(MFA_VERIFY_PATH);
  const parsed = totpCodeSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const limit = await consumeRateLimit("mfaVerify", session.userId);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factorId =
    mode === "enroll"
      ? factors?.all.find((f) => f.factor_type === "totp" && f.status === "unverified")?.id
      : factors?.totp.find((f) => f.status === "verified")?.id;
  if (!factorId) {
    return { error: "2段階認証の設定が見つかりません。最初からやり直してください。" };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: parsed.data.code,
  });
  if (error) {
    await recordAudit({ actorId: session.userId, action: "admin.mfa_failed", payload: { mode } });
    return { error: authErrorMessage({ ...error, code: error.code ?? "mfa_verification_failed" }) };
  }
  await recordAudit({
    actorId: session.userId,
    action: mode === "enroll" ? "admin.mfa_enrolled" : "admin.mfa_verified",
    payload: { factor_id: factorId },
  });
  redirect(safeNextPath(parsed.data.next));
}
