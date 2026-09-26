import { PRICING } from "./config";
import { assertNonNegativeYen, ceilDiv, floorDiv, mulYen, sumYen } from "./money";

/** 30 分の端数を 1 時間に切り上げた時間数。hours = ceil(slots / 2)（SPEC §5）。 */
export function hoursForSlots(slots: number): number {
  assertSlots(slots);
  return ceilDiv(slots, 2);
}

export function assertSlots(slots: number): void {
  if (!Number.isSafeInteger(slots) || slots < 1 || slots > PRICING.maxSlotsPerBooking) {
    throw new RangeError(
      `slots must be an integer in 1..${PRICING.maxSlotsPerBooking}, got ${slots}`,
    );
  }
}

export function assertPricePer30min(price: number): void {
  if (!Number.isSafeInteger(price) || price < 1 || price > PRICING.maxPricePer30min) {
    throw new RangeError(
      `pricePer30min must be an integer in 1..${PRICING.maxPricePer30min}, got ${price}`,
    );
  }
}

/** 税抜額に対する消費税（1円未満切り捨て）。 */
export function consumptionTax(amountExclTax: number): number {
  return floorDiv(mulYen(amountExclTax, PRICING.consumptionTaxPercent), 100);
}

/** Stripe 決済手数料の見込み額 = ceil(利用料金 × 3.6%)（SPEC §5）。 */
export function estimateStripeFee(subtotal: number): number {
  assertNonNegativeYen(subtotal, "subtotal");
  const { numerator, denominator } = PRICING.stripeFeeRate;
  return ceilDiv(mulYen(subtotal, numerator), denominator);
}

/** 予約1件の料金内訳。booking_fees に確定時の値として保存する。 */
export interface BookingFees {
  slots: number;
  hours: number;
  pricePer30min: number;
  /** 利用料金（税込）= 30分あたり料金 × 枠数。利用者の支払額。 */
  subtotal: number;
  platformFeeExclTax: number;
  platformFeeTax: number;
  stripeFeeEstimated: number;
  /** 税抜手数料 + 消費税 + Stripe 手数料の見込み額 */
  applicationFee: number;
  /** 貸出主への送金額 = 利用料金 − application fee */
  hostPayout: number;
}

export function calcBookingFees(input: { pricePer30min: number; slots: number }): BookingFees {
  const { pricePer30min, slots } = input;
  assertPricePer30min(pricePer30min);
  const hours = hoursForSlots(slots);
  const subtotal = mulYen(pricePer30min, slots);
  const platformFeeExclTax = mulYen(PRICING.platformFeePerHourExclTax, hours);
  const platformFeeTax = consumptionTax(platformFeeExclTax);
  const stripeFeeEstimated = estimateStripeFee(subtotal);
  const applicationFee = platformFeeExclTax + platformFeeTax + stripeFeeEstimated;
  return {
    slots,
    hours,
    pricePer30min,
    subtotal,
    platformFeeExclTax,
    platformFeeTax,
    stripeFeeEstimated,
    applicationFee,
    hostPayout: subtotal - applicationFee,
  };
}

export interface OrderFees {
  bookings: BookingFees[];
  /** 利用者の支払額の合計 */
  total: number;
  /** PaymentIntent の application_fee_amount = 予約ごとの application fee の合計 */
  applicationFeeAmount: number;
  /** 貸出主の Stripe アカウントへ送金される額 */
  transferAmount: number;
}

export function calcOrderFees(
  items: readonly { pricePer30min: number; slots: number }[],
): OrderFees {
  if (items.length === 0) throw new RangeError("order must contain at least one booking");
  const bookings = items.map(calcBookingFees);
  const total = sumYen(bookings.map((b) => b.subtotal));
  const applicationFeeAmount = sumYen(bookings.map((b) => b.applicationFee));
  return { bookings, total, applicationFeeAmount, transferAmount: total - applicationFeeAmount };
}

/**
 * 税込額に含まれる消費税（内税。1円未満切り捨て）。領収書・請求書では、書類ごとに1回だけ端数処理する
 * （適格請求書の要件）。例: 1,100円 → 100円
 */
export function includedConsumptionTax(amountInclTax: number): number {
  const rate = PRICING.consumptionTaxPercent;
  return floorDiv(mulYen(amountInclTax, rate), 100 + rate);
}
