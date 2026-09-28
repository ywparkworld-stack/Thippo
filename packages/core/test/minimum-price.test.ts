import { describe, expect, it } from "vitest";
import {
  PRICING,
  calcBookingFees,
  calcRefund,
  isHostNetNonNegative,
  isPriceAllowed,
  minimumPricePer30min,
} from "../src";

describe("minimumPricePer30min", () => {
  it("最低利用枠数 1 のときの下限は 237 円", () => {
    // 1 枠 = 1 時間分の手数料。半額キャンセルの手取り ceil(P/2) − 110 − ceil(3.6% × P)
    //   P=237: 119 − 110 − 9 = 0,  P=236: 118 − 110 − 9 = −1
    expect(minimumPricePer30min(1)).toBe(237);
  });

  it("最低利用枠数が大きいほど下限は下がる（増えない）", () => {
    let prev = Infinity;
    for (let m = 1; m <= PRICING.maxSlotsPerBooking; m++) {
      const min = minimumPricePer30min(m);
      expect(min).toBeLessThanOrEqual(prev);
      prev = min;
    }
  });

  it("下限ちょうどの料金で半額キャンセルしても、貸出主の手取りはマイナスにならない", () => {
    for (let m = 1; m <= PRICING.maxSlotsPerBooking; m++) {
      const price = minimumPricePer30min(m);
      for (let slots = m; slots <= PRICING.maxSlotsPerBooking; slots++) {
        const fees = calcBookingFees({ pricePer30min: price, slots });
        const half = calcRefund(fees, "half");
        expect(half.hostNet).toBeGreaterThanOrEqual(0);
        expect(half.transferReversalAmount).toBeGreaterThanOrEqual(0);
        expect(calcRefund(fees, "none").hostNet).toBeGreaterThanOrEqual(0);
        expect(calcRefund(fees, "full").hostNet).toBe(0);
      }
    }
  });

  it("下限の 1 円下では、どこかの枠数で手取りがマイナスになる", () => {
    for (const m of [1, 2, 3, 4]) {
      const below = minimumPricePer30min(m) - 1;
      const someNegative = Array.from(
        { length: PRICING.maxSlotsPerBooking - m + 1 },
        (_, i) => m + i,
      ).some((slots) => !isHostNetNonNegative(below, slots));
      expect(someNegative).toBe(true);
    }
  });

  it("下限以上のどの料金でも手取りはマイナスにならない（最低利用枠数 1）", () => {
    for (let price = minimumPricePer30min(1); price <= 5000; price++) {
      for (let slots = 1; slots <= PRICING.maxSlotsPerBooking; slots++) {
        expect(isHostNetNonNegative(price, slots)).toBe(true);
      }
    }
  });

  it("isPriceAllowed", () => {
    expect(isPriceAllowed(237, 1)).toBe(true);
    expect(isPriceAllowed(236, 1)).toBe(false);
    expect(isPriceAllowed(237.5, 1)).toBe(false);
    expect(isPriceAllowed(PRICING.maxPricePer30min + 1, 1)).toBe(false);
  });
});
