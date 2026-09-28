import { describe, expect, it } from "vitest";
import { calcBookingFees, calcOrderFees, estimateStripeFee, hoursForSlots } from "../src";

describe("hoursForSlots", () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
  ])("%i 枠 → %i 時間", (slots, hours) => {
    expect(hoursForSlots(slots)).toBe(hours);
  });

  it("0 枠や小数は受け付けない", () => {
    expect(() => hoursForSlots(0)).toThrow();
    expect(() => hoursForSlots(1.5)).toThrow();
    expect(() => hoursForSlots(49)).toThrow();
  });
});

describe("calcBookingFees（30分あたり 1,000 円）", () => {
  it.each([
    // minutes, slots, hours, subtotal, feeExcl, feeTax, stripe, appFee
    [30, 1, 1, 1000, 200, 20, 36, 256],
    [60, 2, 1, 2000, 200, 20, 72, 292],
    [90, 3, 2, 3000, 400, 40, 108, 548],
    [120, 4, 2, 4000, 400, 40, 144, 584],
  ])("%i 分", (_min, slots, hours, subtotal, feeExcl, feeTax, stripe, appFee) => {
    const f = calcBookingFees({ pricePer30min: 1000, slots });
    expect(f).toMatchObject({
      hours,
      subtotal,
      platformFeeExclTax: feeExcl,
      platformFeeTax: feeTax,
      stripeFeeEstimated: stripe,
      applicationFee: appFee,
      hostPayout: subtotal - appFee,
    });
    expect(f.platformFeeExclTax + f.platformFeeTax).toBe(220 * hours);
  });

  it("Stripe 手数料の見込み額は予約ごとに切り上げる", () => {
    expect(estimateStripeFee(1234)).toBe(45); // 44.424 → 45
    expect(estimateStripeFee(1000)).toBe(36); // ちょうど
    expect(estimateStripeFee(1)).toBe(1);
    expect(estimateStripeFee(0)).toBe(0);
    expect(calcBookingFees({ pricePer30min: 1234, slots: 3 })).toMatchObject({
      subtotal: 3702,
      stripeFeeEstimated: 134, // 133.272 → 134
      applicationFee: 400 + 40 + 134,
    });
  });

  it("浮動小数点の誤差が出ない（0.036 を掛けると誤差が出る値）", () => {
    // 1000 × 0.036 = 36.00000000000001 になり、Math.ceil だと 37 になってしまう。
    expect(estimateStripeFee(1000)).toBe(36);
    for (let p = 1; p <= 20000; p++) {
      const exact = Math.floor((p * 36 + 999) / 1000);
      expect(estimateStripeFee(p)).toBe(exact);
    }
  });

  it("不正な料金は受け付けない", () => {
    expect(() => calcBookingFees({ pricePer30min: 0, slots: 1 })).toThrow();
    expect(() => calcBookingFees({ pricePer30min: 100.5, slots: 1 })).toThrow();
    expect(() => calcBookingFees({ pricePer30min: -1, slots: 1 })).toThrow();
  });
});

describe("calcOrderFees", () => {
  it("注文の application fee は予約ごとの application fee の合計と一致する", () => {
    const items = [
      { pricePer30min: 1000, slots: 1 },
      { pricePer30min: 1234, slots: 3 },
      { pricePer30min: 777, slots: 4 },
    ];
    const order = calcOrderFees(items);
    const perBooking = items.map(calcBookingFees);
    expect(order.applicationFeeAmount).toBe(perBooking.reduce((a, b) => a + b.applicationFee, 0));
    expect(order.total).toBe(1000 + 3702 + 3108);
    expect(order.transferAmount).toBe(order.total - order.applicationFeeAmount);
    // 合算した金額に 3.6% を掛けるのではなく、予約ごとに切り上げた見込み額の合計になる
    expect(order.bookings.map((b) => b.stripeFeeEstimated)).toEqual([36, 134, 112]);
  });

  it("空の注文は作れない", () => {
    expect(() => calcOrderFees([])).toThrow();
  });
});

describe("includedConsumptionTax", () => {
  it("税込額から内税を切り捨てで計算する", async () => {
    const { includedConsumptionTax } = await import("../src");
    expect(includedConsumptionTax(1100)).toBe(100);
    expect(includedConsumptionTax(1000)).toBe(90); // 90.9…
    expect(includedConsumptionTax(0)).toBe(0);
  });
});
