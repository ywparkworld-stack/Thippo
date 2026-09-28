"use server";

import { z } from "zod";
import { requireAppSession } from "@thippo/auth/server";
import { sendOrderConfirmedEmails } from "@thippo/mail/booking-emails";
import {
  CHECKOUT_ERROR_MESSAGES,
  checkoutErrorCode,
  closeOwnPendingOrders,
  completeStubPayment,
  createOrderAndPaymentIntent,
} from "@thippo/payments/checkout";

export type StartPaymentResult =
  | { ok: true; orderId: string; clientSecret: string; total: number }
  | { ok: false; message: string; backToCart: boolean };

const schema = z.object({
  agreeTerms: z.literal(true),
  agreeCancelPolicy: z.literal(true),
  /** 画面に表示していた合計。サーバーで計算し直した金額と違えば、確認し直してもらう */
  displayedTotal: z.number().int().nonnegative(),
});

/**
 * 「支払う」を押したとき（SPEC §7-1・7-2）。注文と予約を1つのトランザクションで作り、PaymentIntent を作る。
 * 金額はサーバー（DB 関数）の料金で計算し直す。以前の未払いの注文があれば閉じてから作り直す。
 */
export async function startPaymentAction(input: unknown): Promise<StartPaymentResult> {
  const { userId } = await requireAppSession("guest", "/checkout");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "利用規約とキャンセル規定への同意が必要です。",
      backToCart: false,
    };
  }
  try {
    await closeOwnPendingOrders(userId);
    const payment = await createOrderAndPaymentIntent(userId);
    if (payment.total !== parsed.data.displayedTotal) {
      // 料金が変わった：この注文は使わずに閉じ、画面を更新してもらう
      await closeOwnPendingOrders(userId);
      return {
        ok: false,
        message: "料金が変更されました。内容をご確認のうえ、もう一度お手続きください。",
        backToCart: true,
      };
    }
    return {
      ok: true,
      orderId: payment.orderId,
      clientSecret: payment.clientSecret,
      total: payment.total,
    };
  } catch (e) {
    const code = checkoutErrorCode((e as Error).message);
    if (code === "unknown") console.error(`[checkout] ${(e as Error).message}`);
    return {
      ok: false,
      message:
        CHECKOUT_ERROR_MESSAGES[code] ??
        "お支払いの準備に失敗しました。時間をおいてもう一度お試しください。",
      backToCart: [
        "slot_taken",
        "period_unavailable",
        "space_unavailable",
        "cart_empty",
        "multiple_hosts",
      ].includes(code),
    };
  }
}

/**
 * テスト用の支払いモード（付録 D37）で「支払う」を押したとき。Webhook の payment_intent.succeeded の代わりに、
 * 本人の注文を支払い済みにして確認メールを送る。stub でなければ（本番を含む）例外になり、何もしない。
 */
export async function completeStubPaymentAction(
  orderId: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId } = await requireAppSession("guest", "/checkout");
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return { ok: false, message: "注文が見つかりません。" };
  try {
    const outcome = await completeStubPayment(id.data, userId);
    if (outcome.kind === "expired") {
      return {
        ok: false,
        message: "お支払いの期限を過ぎました。予約カゴからもう一度お手続きください。",
      };
    }
    await sendOrderConfirmedEmails(outcome.orderId);
    return { ok: true };
  } catch (e) {
    console.error(`[checkout:stub] ${(e as Error).message}`);
    return { ok: false, message: "お支払いに失敗しました。時間をおいてもう一度お試しください。" };
  }
}
