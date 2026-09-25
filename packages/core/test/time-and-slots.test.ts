import { describe, expect, it } from "vitest";
import {
  checkCartHost,
  computeDaySlots,
  formatTokyoDateTime,
  periodFromSlotClicks,
  toTokyoDate,
  tokyoToUtc,
  tokyoWeekday,
  validateBookingPeriod,
  type AvailabilityRule,
} from "../src";

const t = (iso: string) => new Date(iso);

describe("time", () => {
  it("東京の日付・時刻と UTC を相互に変換する", () => {
    expect(tokyoToUtc("2026-10-01", 9 * 60).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(tokyoToUtc("2026-10-01", 0).toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(tokyoToUtc("2026-10-01", 24 * 60).toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(toTokyoDate(t("2026-09-30T15:00:00Z"))).toBe("2026-10-01");
    expect(toTokyoDate(t("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
  });

  it("曜日は東京の日付で決まる", () => {
    expect(tokyoWeekday("2026-10-01")).toBe(4); // 木曜
    expect(formatTokyoDateTime(t("2026-10-01T04:30:00Z"))).toBe("2026/10/01(木) 13:30");
  });

  it("存在しない日付は受け付けない", () => {
    expect(() => tokyoToUtc("2026-02-30", 0)).toThrow();
  });
});

// 2026-10-01 は木曜
const rules: AvailabilityRule[] = [
  { weekday: 4, openTime: "09:00", closeTime: "12:00" },
  { weekday: 4, openTime: "13:00", closeTime: "15:00" },
  { weekday: 5, openTime: "22:00", closeTime: "24:00" },
];
const now = t("2026-09-25T12:00:00+09:00");

describe("computeDaySlots", () => {
  it("営業時間を 30 分枠に分ける", () => {
    const slots = computeDaySlots({ date: "2026-10-01", rules, closures: [], busy: [], now });
    expect(slots).toHaveLength(6 + 4);
    expect(slots[0]!.start.toISOString()).toBe(t("2026-10-01T09:00:00+09:00").toISOString());
    expect(slots.at(-1)!.end.toISOString()).toBe(t("2026-10-01T15:00:00+09:00").toISOString());
    expect(slots.every((s) => s.status === "available")).toBe(true);
  });

  it("24:00 までの営業時間", () => {
    const slots = computeDaySlots({ date: "2026-10-02", rules, closures: [], busy: [], now });
    expect(slots.map((s) => s.end.toISOString()).at(-1)).toBe(
      t("2026-10-03T00:00:00+09:00").toISOString(),
    );
  });

  it("休業日と営業日でない曜日は枠がない", () => {
    expect(
      computeDaySlots({ date: "2026-10-01", rules, closures: ["2026-10-01"], busy: [], now }),
    ).toEqual([]);
    expect(computeDaySlots({ date: "2026-10-03", rules, closures: [], busy: [], now })).toEqual([]);
  });

  it("予約済み・過去・受付期間外の枠", () => {
    const busy = [{ start: t("2026-10-01T10:00:00+09:00"), end: t("2026-10-01T11:00:00+09:00") }];
    const slots = computeDaySlots({ date: "2026-10-01", rules, closures: [], busy, now });
    expect(slots.filter((s) => s.status === "booked").map((s) => s.start.toISOString())).toEqual([
      t("2026-10-01T10:00:00+09:00").toISOString(),
      t("2026-10-01T10:30:00+09:00").toISOString(),
    ]);

    const past = computeDaySlots({
      date: "2026-10-01",
      rules,
      closures: [],
      busy: [],
      now: t("2026-10-01T10:00:00+09:00"),
    });
    expect(past.filter((s) => s.status === "past")).toHaveLength(3); // 9:00, 9:30, 10:00

    // 30日後の 10:00 までが受付期間。終了が 10:00 を超える枠は受け付けない
    const far = computeDaySlots({
      date: "2026-10-01",
      rules,
      closures: [],
      busy: [],
      now: t("2026-09-01T10:00:00+09:00"),
    });
    expect(far.filter((s) => s.status === "available").map((s) => s.end.toISOString())).toEqual([
      t("2026-10-01T09:30:00+09:00").toISOString(),
      t("2026-10-01T10:00:00+09:00").toISOString(),
    ]);
  });
});

describe("validateBookingPeriod", () => {
  const base = { minSlots: 2, rules, closures: [], busy: [], now };

  it("予約できる期間", () => {
    const r = validateBookingPeriod({
      ...base,
      start: t("2026-10-01T09:00:00+09:00"),
      end: t("2026-10-01T10:30:00+09:00"),
    });
    expect(r).toMatchObject({ ok: true, slots: 3 });
  });

  it("最低利用枠数未満", () => {
    const r = validateBookingPeriod({
      ...base,
      start: t("2026-10-01T09:00:00+09:00"),
      end: t("2026-10-01T09:30:00+09:00"),
    });
    expect(r).toEqual({ ok: false, error: "below_min_slots" });
  });

  it("30分刻みでない", () => {
    const r = validateBookingPeriod({
      ...base,
      start: t("2026-10-01T09:15:00+09:00"),
      end: t("2026-10-01T10:15:00+09:00"),
    });
    expect(r).toEqual({ ok: false, error: "not_aligned" });
  });

  it("休憩時間をまたぐ", () => {
    const r = validateBookingPeriod({
      ...base,
      start: t("2026-10-01T11:30:00+09:00"),
      end: t("2026-10-01T13:30:00+09:00"),
    });
    expect(r).toEqual({ ok: false, error: "outside_opening_hours" });
  });

  it("予約済みの枠を含む", () => {
    const busy = [{ start: t("2026-10-01T09:30:00+09:00"), end: t("2026-10-01T10:00:00+09:00") }];
    const r = validateBookingPeriod({
      ...base,
      busy,
      start: t("2026-10-01T09:00:00+09:00"),
      end: t("2026-10-01T10:30:00+09:00"),
    });
    expect(r).toEqual({ ok: false, error: "not_available" });
  });

  it("終了が開始以前", () => {
    const r = validateBookingPeriod({
      ...base,
      start: t("2026-10-01T10:00:00+09:00"),
      end: t("2026-10-01T10:00:00+09:00"),
    });
    expect(r).toEqual({ ok: false, error: "invalid_range" });
  });

  it("開始枠と終了枠のクリックから期間を作る（逆順でもよい）", () => {
    const slots = computeDaySlots({ date: "2026-10-01", rules, closures: [], busy: [], now });
    const p = periodFromSlotClicks(slots[3]!, slots[1]!);
    expect(p.start.toISOString()).toBe(slots[1]!.start.toISOString());
    expect(p.end.toISOString()).toBe(slots[3]!.end.toISOString());
  });
});

describe("checkCartHost", () => {
  it("同じ貸出主か空のカゴなら追加できる", () => {
    expect(checkCartHost(null, "h1")).toEqual({ ok: true });
    expect(checkCartHost("h1", "h1")).toEqual({ ok: true });
  });
  it("別の貸出主は追加できない", () => {
    expect(checkCartHost("h1", "h2")).toMatchObject({
      ok: false,
      message: "予約カゴを分けて購入する必要があります",
    });
  });
});
