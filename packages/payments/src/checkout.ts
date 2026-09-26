import "server-only";
import type Stripe from "stripe";
import { STRIPE_CONNECT } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { idempotencyKey, stripe } from "./server";

/** DB 関数のエラーコード → 利用者向けの文言 */
export const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  slot_taken: "他の方が先に予約しました。予約カゴの内容をご確認ください。",
  period_unavailable: "予約できなくなった時間帯があります。予約カゴの内容をご確認ください。",
  space_unavailable: "予約を受け付けていないスペースがあります。予約カゴの内容をご確認ください。",
  host_unavailable: "このスペースは現在予約を受け付けていません。",
  identity_not_approved: "ご予約には本人確認が必要です。",
  cart_empty: "予約カゴが空です。",
  multiple_hosts: "予約カゴを分けて購入する必要があります。",
  previous_payment_processing:
    "前回のお支払いを処理しています。しばらくしてから予約履歴をご確認ください。",
};

export function checkoutErrorCode(message: string | undefined): string {
  return Object.keys(CHECKOUT_ERROR_MESSAGES).find((k) => message?.includes(k)) ?? "unknown";
}

export interface CreatedPayment {
  orderId: string;
  orderNumber: string;
  total: number;
  clientSecret: string;
}

/**
 * 利用者の pending の注文を閉じる（購入手続きをやり直すとき）。PaymentIntent を取り消せたものだけ expired にする。
 * 支払いが処理中・成功済みで取り消せなければ例外にする。
 */
export async function closeOwnPendingOrders(guestId: string): Promise<void> {
  const service = createSupabaseServiceClient();
  const { data: pending } = await service
    .from("orders")
    .select("id, stripe_payment_intent_id")
    .eq("guest_id", guestId)
    .eq("status", "pending");
  for (const o of pending ?? []) {
    if (o.stripe_payment_intent_id) {
      const ok = await cancelPaymentIntent(o.stripe_payment_intent_id);
      if (!ok) throw new Error("previous_payment_processing");
    }
    await service.rpc("close_pending_order", { p_order_id: o.id, p_status: "expired" });
  }
}

/** PaymentIntent を取り消す。すでに取り消し済みなら true、成功済み・処理中で取り消せなければ false */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<boolean> {
  const pi = await stripe().paymentIntents.retrieve(paymentIntentId);
  if (pi.status === "canceled") return true;
  if (pi.status === "succeeded" || pi.status === "processing") return false;
  await stripe().paymentIntents.cancel(
    paymentIntentId,
    { cancellation_reason: "abandoned" },
    { idempotencyKey: idempotencyKey("pi-cancel", paymentIntentId) },
  );
  return true;
}

/**
 * 注文を作って PaymentIntent を作る（SPEC §7-1・7-2）。
 * Destination charges：送金先 = 貸出主の Stripe アカウント、application_fee_amount = 予約ごとの application fee の合計。
 */
export async function createOrderAndPaymentIntent(guestId: string): Promise<CreatedPayment> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc("create_order_from_cart", { p_guest_id: guestId });
  if (error || !data?.[0]) throw new Error(checkoutErrorCode(error?.message));
  const order = data[0];

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe().paymentIntents.create(
      {
        amount: order.total,
        currency: STRIPE_CONNECT.currency,
        // 当分はカードのみ（付録 D20）
        payment_method_types: ["card"],
        application_fee_amount: order.application_fee_amount,
        transfer_data: { destination: order.host_stripe_account_id },
        description: `thippo ${order.order_number}`,
        metadata: { order_id: order.order_id, order_number: order.order_number, guest_id: guestId },
      },
      { idempotencyKey: idempotencyKey("order-payment-intent", order.order_id) },
    );
  } catch (e) {
    // PaymentIntent を作れなければ注文を閉じて枠を解放する
    await service.rpc("close_pending_order", { p_order_id: order.order_id, p_status: "failed" });
    throw e;
  }
  await service.rpc("set_order_payment_intent", {
    p_order_id: order.order_id,
    p_payment_intent_id: pi.id,
  });
  if (!pi.client_secret) throw new Error("missing client secret");
  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    total: order.total,
    clientSecret: pi.client_secret,
  };
}

export type PaymentOutcome =
  | { kind: "paid"; orderId: string }
  | { kind: "already_paid"; orderId: string }
  | { kind: "late_refunded"; orderId: string }
  | { kind: "ignored" };

/**
 * payment_intent.succeeded の処理（SPEC §7-3）。Webhook と注文完了画面の両方から呼ぶ（どちらが先でもよい）。
 * 期限切れ・失敗のあとで成功した支払いは、自動で全額返金する（付録 D8。決済手数料は運営が負担）。
 */
export async function processSucceededPaymentIntent(
  pi: Stripe.PaymentIntent,
): Promise<PaymentOutcome> {
  const orderId = pi.metadata?.order_id;
  if (!orderId || pi.status !== "succeeded") return { kind: "ignored" };

  let chargeId: string | null = null;
  let transferId: string | null = null;
  if (pi.latest_charge) {
    const charge =
      typeof pi.latest_charge === "string"
        ? await stripe().charges.retrieve(pi.latest_charge)
        : pi.latest_charge;
    chargeId = charge.id;
    transferId =
      typeof charge.transfer === "string" ? charge.transfer : (charge.transfer?.id ?? null);
  }

  const service = createSupabaseServiceClient();
  const { data: result, error } = await service.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_payment_intent_id: pi.id,
    p_amount: pi.amount_received,
    // 引数の型は null を許さないが、DB 関数は null を受け付ける（送金がまだない場合など）
    p_charge_id: chargeId as string,
    p_transfer_id: transferId as string,
  });
  if (error) throw new Error(`mark_order_paid failed: ${error.message}`);

  if (result === "late") {
    const refund = await stripe().refunds.create(
      {
        payment_intent: pi.id,
        // 注文全体の返金なので、送金と運営手数料もあわせて戻す
        reverse_transfer: true,
        refund_application_fee: true,
        reason: "requested_by_customer",
        metadata: { order_id: orderId, reason: "late_payment_after_expiry" },
      },
      { idempotencyKey: idempotencyKey("late-payment-refund", pi.id) },
    );
    await service.rpc("record_late_payment_refund", {
      p_order_id: orderId,
      p_refund_id: refund.id,
    });
    return { kind: "late_refunded", orderId };
  }
  return result === "paid" ? { kind: "paid", orderId } : { kind: "already_paid", orderId };
}

/** payment_intent.canceled / payment_failed の最終失敗：注文を failed にして枠を解放する */
export async function processCanceledPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata?.order_id;
  if (!orderId) return;
  await createSupabaseServiceClient().rpc("close_pending_order", {
    p_order_id: orderId,
    p_status: "failed",
  });
}

/** 15分以上 pending の注文を expired にし、PaymentIntent を取り消す（定期実行。SPEC §7-4・付録 D8） */
export async function expireDueOrders(): Promise<{ expired: number; cancelFailures: number }> {
  const { data, error } = await createSupabaseServiceClient().rpc("expire_due_orders", {});
  if (error) throw new Error(`expire_due_orders failed: ${error.message}`);
  let cancelFailures = 0;
  for (const row of data ?? []) {
    if (!row.payment_intent_id) continue;
    try {
      // 取り消せない（成功済み）場合は、Webhook の payment_intent.succeeded で自動返金される
      await cancelPaymentIntent(row.payment_intent_id);
    } catch (e) {
      cancelFailures++;
      console.error(`[expire] failed to cancel ${row.payment_intent_id}: ${(e as Error).message}`);
    }
  }
  return { expired: data?.length ?? 0, cancelFailures };
}
