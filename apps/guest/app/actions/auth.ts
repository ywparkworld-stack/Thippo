"use server";

import * as auth from "@thippo/auth/actions";
import type { FormState } from "@thippo/auth";

// アプリ名はここで固定する（クライアントから受け取らない）
const APP = "guest";

export async function signInAction(_prev: FormState, formData: FormData) {
  return auth.signIn(APP, formData);
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData) {
  return auth.requestPasswordReset(APP, formData);
}

export async function updatePasswordAction(_prev: FormState, formData: FormData) {
  return auth.updatePassword(APP, formData);
}

export async function signOutAction() {
  await auth.signOut(APP);
}

export async function signUpAction(_prev: FormState, formData: FormData) {
  return auth.signUpGuest(formData);
}
