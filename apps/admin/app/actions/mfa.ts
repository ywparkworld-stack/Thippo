"use server";

import * as auth from "@thippo/auth/actions";
import type { FormState } from "@thippo/auth";

export async function startEnrollmentAction() {
  const r = await auth.startTotpEnrollment();
  // 秘密鍵は画面に表示する分だけ返す（factorId はサーバー側で listFactors から引く）
  return r.enrollment
    ? { enrollment: { qrCode: r.enrollment.qrCode, secret: r.enrollment.secret } }
    : { error: r.error };
}

export async function verifyEnrollmentAction(_prev: FormState, formData: FormData) {
  return auth.verifyTotp("enroll", formData);
}

export async function verifyTotpAction(_prev: FormState, formData: FormData) {
  return auth.verifyTotp("verify", formData);
}
