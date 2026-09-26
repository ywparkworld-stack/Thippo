import "server-only";
import type Stripe from "stripe";
import {
  processCanceledPaymentIntent,
  processSucceededPaymentIntent,
} from "@thippo/payments/checkout";
import { sendLatePaymentRefundedEmail, sendOrderConfirmedEmails } from "./order-emails";

/** 支払い成功の処理とメール送信（Webhook・注文完了画面の両方から呼ぶ） */
export async function handleSucceededPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  const outcome = await processSucceededPaymentIntent(pi);
  if (outcome.kind === "paid" || outcome.kind === "already_paid") {
    await sendOrderConfirmedEmails(outcome.orderId);
  } else if (outcome.kind === "late_refunded") {
    await sendLatePaymentRefundedEmail(outcome.orderId);
  }
}

/** プラットフォームのイベント（SPEC §7） */
export async function handlePlatformEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handleSucceededPaymentIntent(event.data.object);
      return;
    case "payment_intent.canceled":
      await processCanceledPaymentIntent(event.data.object);
      return;
    default:
      // charge.refunded などはフェーズ7で扱う
      return;
  }
}
