import { describe, expect, it } from "vitest";
import { hasAvailableSlot, planCartMerge, type CartItemInput } from "../src";

const item = (spaceId: string, hostId: string, day: number, hour = 10): CartItemInput => ({
  spaceId,
  hostId,
  start: `2026-12-${String(day).padStart(2, "0")}T${hour}:00:00+09:00`,
  end: `2026-12-${String(day).padStart(2, "0")}T${hour + 1}:00:00+09:00`,
});

describe("planCartMerge（D18）", () => {
  it("ブラウザのカゴが空なら何もしない", () => {
    expect(planCartMerge({ hostId: null, items: [] }, [])).toEqual({ action: "keep_server" });
  });

  it("サーバーのカゴが空ならブラウザの内容を移す", () => {
    const local = [item("s1", "h1", 1), item("s1", "h1", 2)];
    expect(planCartMerge({ hostId: null, items: [] }, local)).toEqual({
      action: "append",
      items: local,
    });
  });

  it("同じ貸出主なら、重ならないものだけを移す", () => {
    const server = [item("s1", "h1", 1)];
    const local = [item("s1", "h1", 1), item("s2", "h1", 1)];
    expect(planCartMerge({ hostId: "h1", items: server }, local)).toEqual({
      action: "append",
      items: [local[1]],
    });
  });

  it("貸出主が違えばサーバーのカゴを優先し、ブラウザのカゴを捨てる", () => {
    expect(
      planCartMerge({ hostId: "h1", items: [item("s1", "h1", 1)] }, [item("s9", "h2", 1)]),
    ).toEqual({
      action: "discard_local",
      reason: "different_host",
    });
  });

  it("上限（10件）を超える分は移さない", () => {
    const server = Array.from({ length: 9 }, (_, i) => item("s1", "h1", i + 1));
    const local = [item("s1", "h1", 20), item("s1", "h1", 21)];
    expect(planCartMerge({ hostId: "h1", items: server }, local)).toEqual({
      action: "append",
      items: [local[0]],
    });
  });
});

describe("hasAvailableSlot", () => {
  const rules = [{ weekday: 4, openTime: "10:00", closeTime: "11:00" }];
  const now = new Date("2026-09-25T12:00:00+09:00");
  it("空き枠が1枠以上あれば true", () => {
    expect(hasAvailableSlot({ date: "2026-10-01", rules, closures: [], busy: [], now })).toBe(true);
  });
  it("すべて予約済み・休業日・営業日でない日は false", () => {
    const busy = [
      { start: new Date("2026-10-01T10:00:00+09:00"), end: new Date("2026-10-01T11:00:00+09:00") },
    ];
    expect(hasAvailableSlot({ date: "2026-10-01", rules, closures: [], busy, now })).toBe(false);
    expect(
      hasAvailableSlot({ date: "2026-10-01", rules, closures: ["2026-10-01"], busy: [], now }),
    ).toBe(false);
    expect(hasAvailableSlot({ date: "2026-10-02", rules, closures: [], busy: [], now })).toBe(
      false,
    );
  });
});
