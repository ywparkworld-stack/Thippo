import { PRICING, minimumPricePer30min } from "@thippo/core";

/** 最低利用枠数ごとの料金の下限（サーバーで計算して画面に渡す） */
export function minPriceTable(): number[] {
  return Array.from({ length: PRICING.maxSlotsPerBooking }, (_, i) => minimumPricePer30min(i + 1));
}
