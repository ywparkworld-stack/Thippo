import { describe, expect, it } from "vitest";
import {
  calcBookingFees,
  calcRefund,
  cancelCountWindowStart,
  decideCancellation,
  type CancelActor,
} from "../src";

const start = new Date("2026-10-01T10:00:00+09:00");
const at = (iso: string) => new Date(iso);
const decide = (now: Date, count = 0, actor: CancelActor = "guest") =>
  decideCancellation({ actor, now, start, recentGuestCancelCount: count });

describe("decideCancellation", () => {
  it("start − 2時間より前は全額返金", () => {
    expect(decide(at("2026-10-01T07:59:59.999+09:00"))).toMatchObject({
      policy: "full",
      reason: "before_deadline",
    });
  });

  it("start − 2時間ちょうどは半額返金", () => {
    expect(decide(at("2026-10-01T08:00:00+09:00"))).toMatchObject({
      policy: "half",
      reason: "within_deadline",
    });
  });

  it("start の直前は半額返金", () => {
    expect(decide(at("2026-10-01T09:59:59.999+09:00"))).toMatchObject({ policy: "half" });
  });

  it("start ちょうどは返金なし", () => {
    expect(decide(at("2026-10-01T10:00:00+09:00"))).toMatchObject({
      policy: "none",
      reason: "after_start",
    });
  });

  it("利用開始後は返金なし", () => {
    expect(decide(at("2026-10-01T11:00:00+09:00"))).toMatchObject({
      policy: "none",
      reason: "after_start",
    });
  });

  it("過去24時間のキャンセルが4回なら通常どおり（5回目のキャンセル）", () => {
    expect(decide(at("2026-09-30T10:00:00+09:00"), 4)).toMatchObject({
      policy: "full",
      nthCancelInWindow: 5,
      countsTowardLimit: true,
    });
    expect(decide(at("2026-10-01T09:00:00+09:00"), 4)).toMatchObject({
      policy: "half",
      nthCancelInWindow: 5,
    });
  });

  it("過去24時間のキャンセルがすでに5回なら返金なし（6回目のキャンセル）", () => {
    expect(decide(at("2026-09-30T10:00:00+09:00"), 5)).toMatchObject({
      policy: "none",
      reason: "too_many_cancels",
      nthCancelInWindow: 6,
    });
    expect(decide(at("2026-10-01T09:00:00+09:00"), 7)).toMatchObject({
      policy: "none",
      reason: "too_many_cancels",
    });
  });

  it("利用開始後は回数より先に判定する", () => {
    expect(decide(at("2026-10-01T10:30:00+09:00"), 5)).toMatchObject({ reason: "after_start" });
  });

  it("返金なしのキャンセルも回数に数える", () => {
    expect(decide(at("2026-10-01T10:30:00+09:00"), 0).countsTowardLimit).toBe(true);
  });

  it.each(["host", "admin"] as const)(
    "%s からのキャンセルは常に全額返金で、回数に数えない",
    (actor) => {
      for (const now of [
        at("2026-09-30T00:00:00+09:00"),
        at("2026-10-01T09:00:00+09:00"),
        at("2026-10-01T12:00:00+09:00"),
      ]) {
        expect(decide(now, 10, actor)).toEqual({
          policy: "full",
          reason: "by_host_or_admin",
          countsTowardLimit: false,
          nthCancelInWindow: null,
        });
      }
    },
  );

  it("キャンセル回数の窓は now から 24 時間遡る", () => {
    expect(cancelCountWindowStart(at("2026-10-01T00:30:00+09:00")).toISOString()).toBe(
      at("2026-09-30T00:30:00+09:00").toISOString(),
    );
  });
});

describe("calcRefund（30分あたり 1,000 円 × 2 枠 = 2,000 円）", () => {
  const fees = calcBookingFees({ pricePer30min: 1000, slots: 2 });
  // applicationFee = 200 + 20 + 72 = 292, hostPayout = 1708

  it("全額返金：差し戻しは 利用料金 − application fee。貸出主の手取り 0、運営は Stripe 手数料を負担", () => {
    const r = calcRefund(fees, "full");
    expect(r).toMatchObject({
      refundAmount: 2000,
      transferReversalAmount: 2000 - 292,
      platformFeeExclTax: 0,
      platformFeeTax: 0,
      stripeFeeBearer: "platform",
      hostNet: 0,
      platformNetEstimated: -72,
      requiresStripe: true,
    });
  });

  it("半額返金：差し戻しは 返金額 − 110 × hours。運営の手取りは 110 × hours", () => {
    const r = calcRefund(fees, "half");
    expect(r).toMatchObject({
      refundAmount: 1000,
      transferReversalAmount: 1000 - 110,
      platformFeeExclTax: 100,
      platformFeeTax: 10,
      stripeFeeBearer: "host",
      hostNet: 1708 - 890,
      platformNetEstimated: 110,
      requiresStripe: true,
    });
    // 貸出主の手取り = 利用料金 − 返金額 − 110h − Stripe 手数料
    expect(r.hostNet).toBe(2000 - 1000 - 110 - 72);
  });

  it("半額返金は 1円未満を切り捨てる", () => {
    const odd = calcBookingFees({ pricePer30min: 1001, slots: 3 }); // 3003 円, 2 時間
    const r = calcRefund(odd, "half");
    expect(r.refundAmount).toBe(1501);
    expect(r.transferReversalAmount).toBe(1501 - 220);
    expect(r.platformNetEstimated).toBe(220);
  });

  it("返金なし：Stripe の処理なし。運営の手取りは 220 × hours", () => {
    const r = calcRefund(fees, "none");
    expect(r).toMatchObject({
      refundAmount: 0,
      transferReversalAmount: 0,
      platformFeeExclTax: 200,
      platformFeeTax: 20,
      hostNet: 1708,
      platformNetEstimated: 220,
      requiresStripe: false,
    });
  });

  it("お金の合計が合う：利用者の支払い − 返金 = 貸出主の手取り + 運営の手取り + Stripe 手数料", () => {
    for (const price of [237, 500, 1000, 1234, 9999]) {
      for (let slots = 1; slots <= 48; slots++) {
        const f = calcBookingFees({ pricePer30min: price, slots });
        for (const policy of ["full", "half", "none"] as const) {
          const r = calcRefund(f, policy);
          expect(f.subtotal - r.refundAmount).toBe(
            r.hostNet + r.platformNetEstimated + f.stripeFeeEstimated,
          );
        }
      }
    }
  });
});
