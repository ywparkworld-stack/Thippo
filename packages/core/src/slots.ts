import { BOOKING, PRICING, SLOT_MINUTES } from "./config";
import { isSlotAligned, timeToMinutes, tokyoToUtc, tokyoWeekday, toTokyoDate } from "./time";

const MINUTE_MS = 60_000;
const SLOT_MS = SLOT_MINUTES * MINUTE_MS;

export interface AvailabilityRule {
  /** 0 = 日曜 … 6 = 土曜 */
  weekday: number;
  /** "HH:MM"（東京時間） */
  openTime: string;
  /** "HH:MM"（東京時間、"24:00" 可） */
  closeTime: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

export type SlotStatus =
  /** 予約できる */
  | "available"
  /** pending / confirmed の予約と重なる */
  | "booked"
  /** 開始時刻を過ぎている */
  | "past"
  /** 予約受付期間（30日先まで）を超える */
  | "beyond_window";

export interface Slot {
  start: Date;
  end: Date;
  status: SlotStatus;
}

export interface DaySlotsInput {
  /** 東京の日付 "YYYY-MM-DD" */
  date: string;
  rules: readonly AvailabilityRule[];
  /** 休業日 "YYYY-MM-DD" */
  closures: readonly string[];
  /** pending / confirmed の予約の期間 */
  busy: readonly Interval[];
  now: Date;
}

/** 営業時間の範囲を 30 分刻みで返す（東京の 0 時からの分）。重なるルールはまとめる。 */
function openRanges(rules: readonly AvailabilityRule[], weekday: number): [number, number][] {
  const ranges = rules
    .filter((r) => r.weekday === weekday)
    .map((r): [number, number] => [timeToMinutes(r.openTime), timeToMinutes(r.closeTime)])
    .filter(([open, close]) => open < close)
    .map(([open, close]): [number, number] => [
      Math.ceil(open / SLOT_MINUTES) * SLOT_MINUTES,
      Math.floor(close / SLOT_MINUTES) * SLOT_MINUTES,
    ])
    .filter(([open, close]) => open < close)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function maxBookableEnd(now: Date): Date {
  return new Date(now.getTime() + BOOKING.maxAdvanceDays * 24 * 60 * MINUTE_MS);
}

/** その日の 30 分枠の一覧。休業日や営業時間外の日は空配列。 */
export function computeDaySlots(input: DaySlotsInput): Slot[] {
  const { date, rules, closures, busy, now } = input;
  if (closures.includes(date)) return [];
  const limit = maxBookableEnd(now).getTime();
  const nowMs = now.getTime();
  const slots: Slot[] = [];

  for (const [open, close] of openRanges(rules, tokyoWeekday(date))) {
    for (let m = open; m < close; m += SLOT_MINUTES) {
      const start = tokyoToUtc(date, m);
      const end = new Date(start.getTime() + SLOT_MS);
      let status: SlotStatus = "available";
      if (start.getTime() <= nowMs) status = "past";
      else if (end.getTime() > limit) status = "beyond_window";
      else if (busy.some((b) => b.start < end && start < b.end)) status = "booked";
      slots.push({ start, end, status });
    }
  }
  return slots;
}

export type SelectionError =
  | "not_aligned"
  | "invalid_range"
  | "below_min_slots"
  | "too_many_slots"
  | "outside_opening_hours"
  | "not_available";

export type SelectionResult =
  { ok: true; start: Date; end: Date; slots: number } | { ok: false; error: SelectionError };

/**
 * 予約期間が予約できるかを確かめる。カゴに入れるとき・購入手続きの直前にサーバー側で呼ぶ。
 * 期間は1日の営業時間内に収まり、すべての枠が available で、最低利用枠数以上であること。
 */
export function validateBookingPeriod(input: {
  start: Date;
  end: Date;
  minSlots: number;
  rules: readonly AvailabilityRule[];
  closures: readonly string[];
  busy: readonly Interval[];
  now: Date;
}): SelectionResult {
  const { start, end, minSlots } = input;
  if (!isSlotAligned(start) || !isSlotAligned(end)) return { ok: false, error: "not_aligned" };
  if (end.getTime() <= start.getTime()) return { ok: false, error: "invalid_range" };
  const slots = (end.getTime() - start.getTime()) / SLOT_MS;
  if (slots < minSlots) return { ok: false, error: "below_min_slots" };
  if (slots > PRICING.maxSlotsPerBooking) return { ok: false, error: "too_many_slots" };

  const daySlots = computeDaySlots({ ...input, date: toTokyoDate(start) });
  const byStart = new Map(daySlots.map((s) => [s.start.getTime(), s]));
  for (let t = start.getTime(); t < end.getTime(); t += SLOT_MS) {
    const slot = byStart.get(t);
    if (!slot) return { ok: false, error: "outside_opening_hours" };
    if (slot.status !== "available") return { ok: false, error: "not_available" };
  }
  return { ok: true, start, end, slots };
}

/** 開始枠と終了枠（どちらも含む）のクリックから予約期間を作る。 */
export function periodFromSlotClicks(first: Slot, second: Slot): Interval {
  const [a, b] = first.start <= second.start ? [first, second] : [second, first];
  return { start: a.start, end: b.end };
}
