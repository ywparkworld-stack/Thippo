import { CANCELLATION, PRICING } from "./config";
import { consumptionTax, type BookingFees } from "./pricing";
import { mulYen } from "./money";

export type CancelActor = "guest" | "host" | "admin";
export type CancelPolicy = "full" | "half" | "none";
export type CancelReason =
  /** now >= start */
  | "after_start"
  /** 過去24時間の利用者自身のキャンセルがすでに上限回数以上 */
  | "too_many_cancels"
  /** now < start − 2時間 */
  | "before_deadline"
  /** start − 2時間 <= now < start */
  | "within_deadline"
  /** 貸出主・運営からのキャンセル */
  | "by_host_or_admin";

export interface CancelDecision {
  policy: CancelPolicy;
  reason: CancelReason;
  /** このキャンセルを cancel_events に記録するか（利用者自身のキャンセルのみ。SPEC 付録 D3） */
  countsTowardLimit: boolean;
  /** 記録した場合に「過去24時間で何回目のキャンセルか」 */
  nthCancelInWindow: number | null;
}

const MINUTE_MS = 60_000;

/**
 * キャンセル時の返金区分を判定する（SPEC §8 の表を上から順に評価）。
 *
 * @param recentGuestCancelCount now から遡る 24 時間の移動窓に含まれる、
 *   この利用者自身のキャンセル回数（今回の分は含めない）。
 */
export function decideCancellation(input: {
  actor: CancelActor;
  now: Date;
  start: Date;
  recentGuestCancelCount: number;
}): CancelDecision {
  const { actor, now, start, recentGuestCancelCount } = input;
  if (!Number.isSafeInteger(recentGuestCancelCount) || recentGuestCancelCount < 0) {
    throw new RangeError(`recentGuestCancelCount must be a non-negative integer`);
  }

  if (actor !== "guest") {
    return {
      policy: "full",
      reason: "by_host_or_admin",
      countsTowardLimit: false,
      nthCancelInWindow: null,
    };
  }

  const nth = recentGuestCancelCount + 1;
  const base = { countsTowardLimit: true, nthCancelInWindow: nth } as const;
  const nowMs = now.getTime();
  const startMs = start.getTime();

  if (nowMs >= startMs) return { ...base, policy: "none", reason: "after_start" };
  if (recentGuestCancelCount >= CANCELLATION.maxCancelsBeforeNoRefund) {
    return { ...base, policy: "none", reason: "too_many_cancels" };
  }
  if (nowMs < startMs - CANCELLATION.fullRefundBeforeMinutes * MINUTE_MS) {
    return { ...base, policy: "full", reason: "before_deadline" };
  }
  return { ...base, policy: "half", reason: "within_deadline" };
}

/** キャンセル回数を数える窓の開始時刻（now から 24 時間遡る。日付の境界は使わない）。 */
export function cancelCountWindowStart(now: Date): Date {
  return new Date(now.getTime() - CANCELLATION.countWindowHours * 60 * MINUTE_MS);
}

export interface RefundBreakdown {
  policy: CancelPolicy;
  /** 利用者への返金額（refunds.create の amount） */
  refundAmount: number;
  /** 貸出主からの差し戻し額（transfers.createReversal の amount） */
  transferReversalAmount: number;
  /** キャンセル後に運営が受け取る手数料（税抜・消費税） */
  platformFeeExclTax: number;
  platformFeeTax: number;
  /** Stripe 決済手数料の負担者 */
  stripeFeeBearer: "host" | "platform";
  /** 貸出主の最終的な手取り = 送金額 − 差し戻し額 */
  hostNet: number;
  /**
   * 運営の最終的な手取り = application fee + 差し戻し額 − 返金額 − 実際の Stripe 手数料。
   * 実額はあとから balance_transaction で分かるため、ここでは見込み額で計算する。
   */
  platformNetEstimated: number;
  /** Stripe の返金・差し戻し処理が必要か（返金額 0 円なら何もしない。SPEC §8.1） */
  requiresStripe: boolean;
}

/** キャンセル時の返金額と差し戻し額（SPEC §8.1）。 */
export function calcRefund(fees: BookingFees, policy: CancelPolicy): RefundBreakdown {
  const { subtotal, applicationFee, hours, hostPayout, stripeFeeEstimated } = fees;

  let refundAmount: number;
  let transferReversalAmount: number;
  let platformFeeExclTax: number;
  let stripeFeeBearer: "host" | "platform";

  switch (policy) {
    case "full":
      refundAmount = subtotal;
      transferReversalAmount = subtotal - applicationFee;
      platformFeeExclTax = 0;
      stripeFeeBearer = "platform";
      break;
    case "half": {
      refundAmount = (subtotal - (subtotal % 2)) / 2;
      platformFeeExclTax = mulYen(PRICING.halfCancelPlatformFeePerHourExclTax, hours);
      const keptFee = platformFeeExclTax + consumptionTax(platformFeeExclTax);
      transferReversalAmount = refundAmount - keptFee;
      stripeFeeBearer = "host";
      break;
    }
    case "none":
      refundAmount = 0;
      transferReversalAmount = 0;
      platformFeeExclTax = fees.platformFeeExclTax;
      stripeFeeBearer = "host";
      break;
  }

  if (transferReversalAmount < 0 || transferReversalAmount > hostPayout) {
    // 下限料金（minimumPricePer30min）を守っていれば起きない。
    throw new RangeError(
      `transfer reversal ${transferReversalAmount} is out of range 0..${hostPayout} (policy=${policy})`,
    );
  }

  return {
    policy,
    refundAmount,
    transferReversalAmount,
    platformFeeExclTax,
    platformFeeTax: consumptionTax(platformFeeExclTax),
    stripeFeeBearer,
    hostNet: hostPayout - transferReversalAmount,
    platformNetEstimated:
      applicationFee + transferReversalAmount - refundAmount - stripeFeeEstimated,
    requiresStripe: refundAmount > 0,
  };
}

/** キャンセル規定の表示用の文言（SPEC §8。スペース詳細・予約カゴ・購入手続きに表示する） */
export const CANCEL_POLICY_LINES = [
  "利用開始の2時間前まで：全額返金",
  "利用開始の2時間前から利用開始まで：利用料金の半額を返金（1円未満切り捨て）",
  "利用開始後：返金なし",
  "過去24時間以内にご自身で5回以上キャンセルしている場合、6回目以降のキャンセルは返金なし",
  "無断キャンセル（連絡なく利用しなかった場合）：返金なし",
  "貸出主・運営の都合によるキャンセル：全額返金",
] as const;
