import "server-only";
import type Stripe from "stripe";
import {
  processCanceledPaymentIntent,
  processSucceededPaymentIntent,
} from "@thippo/payments/checkout";
import {
  sendLatePaymentRefundedEmail,
  sendOrderConfirmedEmails,
  sendRefundCompletedEmail,
} from "@thippo/mail/booking-emails";
import { processChargeRefunded, processRefundUpdated } from "@thippo/payments/refunds";

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
    case "charge.refunded": {
      // 返金の完了（SPEC §8.1）。予約ごとの返金を完了にし、返金完了のメールを送る
      const completed = await processChargeRefunded(event.data.object);
      for (const refundId of completed) await sendRefundCompletedEmail(refundId);
      return;
    }
    case "charge.refund.updated":
      await processRefundUpdated(event.data.object);
      return;
    default:
      return;
  }
}
