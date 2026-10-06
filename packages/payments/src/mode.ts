/**
 * 決済の動かし方（付録 D37）。
 * - "stripe"：Stripe で決済・返金・入金先の登録を行う（本来の動き）
 * - "stub"：Stripe につながずに、決済・返金・入金先の登録が成功したものとして扱う（開発・確認用）
 * PAYMENTS_MODE がなければ、STRIPE_SECRET_KEY があるときは stripe、ないときは stub にする。
 *
 * stub は本番（APP_ENV=production）では使えない。設定の誤りで実際にお金を受け取らずに予約が確定しないよう、
 * 本番で stub が指定されていたら例外にする。
 */
export type PaymentsMode = "stripe" | "stub";

export function paymentsMode(env: NodeJS.ProcessEnv = process.env): PaymentsMode {
  // 指定がなければ、Stripe のキーがあるときは stripe、ないときは stub（付録 D39：当分は Stripe を使わない）
  const fallback = env.STRIPE_SECRET_KEY ? "stripe" : "stub";
  const raw = (env.PAYMENTS_MODE || fallback).trim().toLowerCase();
  if (raw !== "stripe" && raw !== "stub") {
    throw new Error(`PAYMENTS_MODE must be "stripe" or "stub", got "${raw}"`);
  }
  if (raw === "stub" && env.APP_ENV === "production") {
    throw new Error("PAYMENTS_MODE=stub cannot be used when APP_ENV=production");
  }
  return raw;
}

export function isStubPayments(env: NodeJS.ProcessEnv = process.env): boolean {
  return paymentsMode(env) === "stub";
}

/** stub で作る Stripe 風の id の接頭辞。DB に残る id から stub の取引だと分かるようにする */
export const STUB_PREFIX = {
  paymentIntent: "pi_stub_",
  charge: "ch_stub_",
  transfer: "tr_stub_",
  refund: "re_stub_",
  transferReversal: "trr_stub_",
  account: "acct_stub_",
} as const;

/** stub で作った id か（Stripe の API を呼ばずに済ませる判断に使う） */
export function isStubId(id: string | null | undefined): boolean {
  return typeof id === "string" && /^[a-z]+_stub_/.test(id);
}
