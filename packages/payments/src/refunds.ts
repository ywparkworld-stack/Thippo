import "server-only";
import type Stripe from "stripe";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { isStubId, STUB_PREFIX } from "./mode";
import { idempotencyKey, stripe } from "./server";

export type CancelActor = "guest" | "host" | "admin";

export const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  booking_not_found: "予約が見つかりません。",
  booking_not_cancellable: "この予約はキャンセルできません（キャンセル済み・未確定など）。",
  booking_finished: "利用が終わった予約はキャンセルできません。",
  reason_required: "キャンセルの理由を入力してください。",
  not_allowed: "この予約をキャンセルする権限がありません。",
};

export function cancelErrorCode(message: string | undefined): string {
  return Object.keys(CANCEL_ERROR_MESSAGES).find((k) => message?.includes(k)) ?? "unknown";
}

export interface CancelResult {
  refundId: string;
  policy: "full" | "half" | "none";
  refundAmount: number;
  transferReversalAmount: number;
  nthCancelInWindow: number | null;
  /** Stripe の返金を依頼できたか（0円なら true） */
  refundSubmitted: boolean;
  /** 返金が完了したか（Webhook より先に完了を確かめられた場合。返金完了のメールを送る） */
  refundCompleted: boolean;
}

/**
 * 予約をキャンセルし、返金する（SPEC §8・§8.1）。
 * 判定と記録は DB 関数で行い、そのあと Stripe で返金と差し戻しを行う。Stripe の処理が失敗しても
 * キャンセルは取り消さず、refunds を failed にして運営が再実行できるようにする。
 */
export async function cancelBookingAndRefund(input: {
  bookingId: string;
  actor: CancelActor;
  actorId: string;
  reason?: string | null;
}): Promise<CancelResult> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc("cancel_booking", {
    p_booking_id: input.bookingId,
    p_actor: input.actor,
    p_actor_id: input.actorId,
    p_reason: input.reason ?? undefined,
  });
  if (error || !data?.[0]) throw new Error(cancelErrorCode(error?.message));
  const row = data[0];
  const result =
    row.refund_amount === 0 ? { ok: true, completed: false } : await executeRefund(row.refund_id);
  return {
    refundId: row.refund_id,
    policy: row.policy,
    refundAmount: row.refund_amount,
    transferReversalAmount: row.transfer_reversal_amount,
    nthCancelInWindow: row.nth_cancel_in_window,
    refundSubmitted: result.ok,
    refundCompleted: result.completed,
  };
}

/**
 * Stripe で返金と差し戻しを行う（失敗した返金の再実行にも使う）。
 * - 返金：refunds.create（amount = 返金額、reverse_transfer: false、refund_application_fee: false）
 * - 差し戻し：transfers.createReversal（amount = 差し戻し額）
 * 前回の処理が Stripe では成功していて記録だけ失敗した場合に二重に返金しないよう、
 * metadata の refund_id で Stripe 側の記録を探してから作る。
 */
export async function executeRefund(
  refundId: string,
): Promise<{ ok: boolean; completed: boolean }> {
  const service = createSupabaseServiceClient();
  const { data: refund } = await service
    .from("refunds")
    .select(
      "id, status, refund_amount, transfer_reversal_amount, stripe_refund_id, stripe_transfer_reversal_id, attempts, booking_id, bookings(order_id, orders(stripe_charge_id, stripe_transfer_id))",
    )
    .eq("id", refundId)
    .single();
  if (!refund) throw new Error(`refund ${refundId} not found`);
  if (refund.status === "succeeded" || refund.refund_amount === 0)
    return { ok: true, completed: false };

  const order = (
    refund.bookings as {
      orders: { stripe_charge_id: string | null; stripe_transfer_id: string | null } | null;
    } | null
  )?.orders;
  const metadata = { refund_id: refund.id, booking_id: refund.booking_id };
  let stripeRefundId = refund.stripe_refund_id;
  let reversalId = refund.stripe_transfer_reversal_id;

  try {
    if (!order?.stripe_charge_id) throw new Error("order has no charge");
    if (isStubId(order.stripe_charge_id)) return await completeStubRefund(refund);
    if (!stripeRefundId) {
      const existing = await findStripeRefund(order.stripe_charge_id, refund.id);
      stripeRefundId =
        existing?.id ??
        (
          await stripe().refunds.create(
            {
              charge: order.stripe_charge_id,
              amount: refund.refund_amount,
              reverse_transfer: false,
              refund_application_fee: false,
              metadata,
            },
            { idempotencyKey: idempotencyKey("booking-refund", refund.id, refund.attempts) },
          )
        ).id;
      await service.rpc("record_refund_progress", {
        p_refund_id: refund.id,
        p_stripe_refund_id: stripeRefundId,
        p_stripe_transfer_reversal_id: null as unknown as string,
      });
    }
    if (refund.transfer_reversal_amount > 0 && !reversalId) {
      if (!order.stripe_transfer_id) throw new Error("order has no transfer");
      const existing = await findTransferReversal(order.stripe_transfer_id, refund.id);
      reversalId =
        existing?.id ??
        (
          await stripe().transfers.createReversal(
            order.stripe_transfer_id,
            { amount: refund.transfer_reversal_amount, metadata },
            { idempotencyKey: idempotencyKey("booking-reversal", refund.id, refund.attempts) },
          )
        ).id;
      await service.rpc("record_refund_progress", {
        p_refund_id: refund.id,
        p_stripe_refund_id: null as unknown as string,
        p_stripe_transfer_reversal_id: reversalId,
      });
    }
    // Webhook（charge.refunded）が差し戻しより先に届いていた場合に備え、ここでも完了を確かめる
    const stripeRefund = await stripe().refunds.retrieve(stripeRefundId);
    let completed = false;
    if (stripeRefund.status === "succeeded") {
      const { data: changed } = await service.rpc("mark_refund_succeeded", {
        p_refund_id: refund.id,
        p_stripe_refund_id: stripeRefundId,
      });
      completed = changed === true;
    }
    return { ok: true, completed };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[refund] ${refund.id} failed: ${message}`);
    await service.rpc("record_refund_progress", {
      p_refund_id: refund.id,
      p_stripe_refund_id: stripeRefundId as string,
      p_stripe_transfer_reversal_id: reversalId as string,
      p_error: message.slice(0, 1000),
    });
    return { ok: false, completed: false };
  }
}

/**
 * stub の支払い（D37）の返金。Stripe にはお金が動いていないため、返金と差し戻しを記録してすぐ完了にする。
 * 金額・回数などの判定は Stripe のときと同じ（DB 関数で決めたとおり）。
 */
async function completeStubRefund(refund: {
  id: string;
  transfer_reversal_amount: number;
  stripe_refund_id: string | null;
  stripe_transfer_reversal_id: string | null;
}): Promise<{ ok: boolean; completed: boolean }> {
  const service = createSupabaseServiceClient();
  const stripeRefundId = refund.stripe_refund_id ?? STUB_PREFIX.refund + refund.id;
  const reversalId =
    refund.transfer_reversal_amount > 0
      ? (refund.stripe_transfer_reversal_id ?? STUB_PREFIX.transferReversal + refund.id)
      : null;
  const { error } = await service.rpc("record_refund_progress", {
    p_refund_id: refund.id,
    p_stripe_refund_id: stripeRefundId,
    p_stripe_transfer_reversal_id: reversalId as string,
  });
  if (error) throw new Error(`record_refund_progress failed: ${error.message}`);
  const { data: changed, error: markError } = await service.rpc("mark_refund_succeeded", {
    p_refund_id: refund.id,
    p_stripe_refund_id: stripeRefundId,
  });
  if (markError) throw new Error(`mark_refund_succeeded failed: ${markError.message}`);
  return { ok: true, completed: changed === true };
}

async function findStripeRefund(chargeId: string, refundId: string): Promise<Stripe.Refund | null> {
  const list = await stripe().refunds.list({ charge: chargeId, limit: 100 });
  return (
    list.data.find(
      (r) => r.metadata?.refund_id === refundId && r.status !== "failed" && r.status !== "canceled",
    ) ?? null
  );
}

async function findTransferReversal(
  transferId: string,
  refundId: string,
): Promise<Stripe.TransferReversal | null> {
  const list = await stripe().transfers.listReversals(transferId, { limit: 100 });
  return list.data.find((r) => r.metadata?.refund_id === refundId) ?? null;
}

/**
 * Webhook の charge.refunded（SPEC §8.1）。Stripe で成功した返金を refunds に反映する。
 * 今回完了にした返金の id を返す（返金完了のメールを送るため）。
 */
export async function processChargeRefunded(charge: Stripe.Charge): Promise<string[]> {
  const service = createSupabaseServiceClient();
  const list = await stripe().refunds.list({ charge: charge.id, limit: 100 });
  const completed: string[] = [];
  for (const r of list.data) {
    const refundId = r.metadata?.refund_id;
    if (!refundId || r.status !== "succeeded") continue;
    const { data: changed, error } = await service.rpc("mark_refund_succeeded", {
      p_refund_id: refundId,
      p_stripe_refund_id: r.id,
    });
    if (error) throw new Error(`mark_refund_succeeded failed: ${error.message}`);
    if (changed) completed.push(refundId);
  }
  return completed;
}

/** Webhook の charge.refund.updated：返金が失敗したら failed にする（運営管理から再実行する） */
export async function processRefundUpdated(refund: Stripe.Refund): Promise<void> {
  const refundId = refund.metadata?.refund_id;
  if (!refundId || (refund.status !== "failed" && refund.status !== "canceled")) return;
  await createSupabaseServiceClient().rpc("record_refund_progress", {
    p_refund_id: refundId,
    p_stripe_refund_id: null as unknown as string,
    p_stripe_transfer_reversal_id: null as unknown as string,
    p_error: `stripe refund ${refund.status}: ${refund.failure_reason ?? "unknown"}`,
  });
}
