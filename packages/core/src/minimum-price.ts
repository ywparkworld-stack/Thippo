import { PRICING } from "./config";
import { calcBookingFees } from "./pricing";
import { calcRefund } from "./cancellation";

/**
 * その料金・枠数の予約で、どのキャンセル区分になっても貸出主の手取りがマイナスにならないか。
 *
 * 手取りが最も小さくなるのは次の2つ（料金 P, 時間数 h, 見込み手数料 f = ceil(3.6% × P)）。
 * - 半額返金：ceil(P / 2) − 110h − f >= 0
 * - 返金なし（キャンセルなしと同じ）：P − 220h − f >= 0
 * 全額返金は手取り 0 円で常に満たす。
 */
export function isHostNetNonNegative(pricePer30min: number, slots: number): boolean {
  const fees = calcBookingFees({ pricePer30min, slots });
  if (fees.hostPayout < 0) return false;
  const half = (() => {
    try {
      return calcRefund(fees, "half");
    } catch {
      return null;
    }
  })();
  return half !== null && half.hostNet >= 0;
}

const cache = new Map<number, number>();

/**
 * 貸出主が設定できる 30 分あたり料金の下限（SPEC §5）。
 *
 * 最低利用枠数 minSlots 以上、1件の最大枠数以下のすべての枠数で
 * isHostNetNonNegative を満たし、かつそれ以上のどの料金でも満たし続ける最小の料金。
 * 枠数が少ないほど 1 時間の切り上げの影響が大きいため、minSlots が小さいほど下限は高い。
 */
export function minimumPricePer30min(minSlots = 1): number {
  if (!Number.isSafeInteger(minSlots) || minSlots < 1 || minSlots > PRICING.maxSlotsPerBooking) {
    throw new RangeError(`minSlots must be an integer in 1..${PRICING.maxSlotsPerBooking}`);
  }
  const cached = cache.get(minSlots);
  if (cached !== undefined) return cached;

  const okAt = (price: number) => {
    for (let s = minSlots; s <= PRICING.maxSlotsPerBooking; s++) {
      if (!isHostNetNonNegative(price, s)) return false;
    }
    return true;
  };

  // 切り上げ・切り捨ての影響で単調でない可能性に備え、「ここから上は必ず満たす」点を探す。
  // 条件を満たさない最大の料金を、十分大きな上限から下に向かって探す。
  // 上限: 1時間の手数料 220 円 × 2（1枠で1時間）を 1 − 1/2 − 3.6% で割っても 1,000 円未満。
  const searchCeiling = 2_000;
  let lastFailure = 0;
  for (let p = 1; p <= searchCeiling; p++) {
    if (!okAt(p)) lastFailure = p;
  }
  const result = lastFailure + 1;
  cache.set(minSlots, result);
  return result;
}

export function isPriceAllowed(pricePer30min: number, minSlots: number): boolean {
  return (
    Number.isSafeInteger(pricePer30min) &&
    pricePer30min <= PRICING.maxPricePer30min &&
    pricePer30min >= minimumPricePer30min(minSlots)
  );
}
