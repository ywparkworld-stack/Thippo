import { describe, expect, it } from "vitest";
import {
  BOOKING,
  CANCELLATION,
  PRICING,
  SLOT_MINUTES,
  calcBookingFees,
  isHostNetNonNegative,
  minimumPricePer30min,
} from "@thippo/core";
import { anon, as, asSuperuser } from "./helpers/db";

describe("DB 側の料金計算は packages/core と一致する", () => {
  it("設定値が一致する", async () => {
    const { rows } = await asSuperuser((db) => db.query("select private.pricing_config() as c"));
    expect(rows[0].c).toEqual({
      slotMinutes: SLOT_MINUTES,
      consumptionTaxPercent: PRICING.consumptionTaxPercent,
      platformFeePerHourExclTax: PRICING.platformFeePerHourExclTax,
      halfCancelPlatformFeePerHourExclTax: PRICING.halfCancelPlatformFeePerHourExclTax,
      stripeFeeRateNumerator: PRICING.stripeFeeRate.numerator,
      stripeFeeRateDenominator: PRICING.stripeFeeRate.denominator,
      maxSlotsPerBooking: PRICING.maxSlotsPerBooking,
      maxPricePer30min: PRICING.maxPricePer30min,
      maxAdvanceDays: BOOKING.maxAdvanceDays,
      pendingOrderTtlMinutes: BOOKING.pendingOrderTtlMinutes,
      fullRefundBeforeMinutes: CANCELLATION.fullRefundBeforeMinutes,
      cancelCountWindowHours: CANCELLATION.countWindowHours,
      maxCancelsBeforeNoRefund: CANCELLATION.maxCancelsBeforeNoRefund,
    });
  });

  it("予約1件の料金内訳が一致する", async () => {
    const prices = [1, 237, 500, 999, 1000, 1234, 2777, 10000, 99999];
    const { rows } = await asSuperuser((db) =>
      db.query(
        `select p, s, (private.calc_booking_fees(p, s)).*
         from unnest($1::int[]) p cross join generate_series(1, 48) s`,
        [prices],
      ),
    );
    expect(rows).toHaveLength(prices.length * 48);
    for (const r of rows) {
      const f = calcBookingFees({ pricePer30min: r.p, slots: r.s });
      expect({
        hours: r.hours,
        subtotal: r.subtotal,
        platformFeeExclTax: r.platform_fee_excl_tax,
        platformFeeTax: r.platform_fee_tax,
        stripeFeeEstimated: r.stripe_fee_estimated,
        applicationFee: r.application_fee,
        hostPayout: r.host_payout,
      }).toEqual({
        hours: f.hours,
        subtotal: f.subtotal,
        platformFeeExclTax: f.platformFeeExclTax,
        platformFeeTax: f.platformFeeTax,
        stripeFeeEstimated: f.stripeFeeEstimated,
        applicationFee: f.applicationFee,
        hostPayout: f.hostPayout,
      });
    }
  });

  it("手取りの判定が一致する", async () => {
    const { rows } = await asSuperuser((db) =>
      db.query(
        `select p, s, private.is_host_net_non_negative(p, s) as ok
         from generate_series(200, 300) p cross join generate_series(1, 48) s`,
      ),
    );
    for (const r of rows) expect(r.ok).toBe(isHostNetNonNegative(r.p, r.s));
  });

  it("料金の下限が一致する", async () => {
    const { rows } = await as(anon, (db) =>
      db.query("select m, public.min_price_per_30min(m) as min from generate_series(1, 48) m"),
    );
    for (const r of rows) expect(r.min).toBe(minimumPricePer30min(r.m));
  });

  it("範囲外の枠数・料金はエラー", async () => {
    await asSuperuser(async (db) => {
      await expect(db.query("select private.calc_booking_fees(1000, 0)")).rejects.toThrow(/slots/);
      await expect(db.query("select private.calc_booking_fees(0, 1)")).rejects.toThrow(/price/);
    });
  });
});
