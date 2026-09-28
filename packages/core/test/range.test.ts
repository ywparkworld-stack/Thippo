import { describe, expect, it } from "vitest";
import { parseTstzRange, toTstzRange } from "../src";

describe("tstzrange", () => {
  it("PostgreSQL の表記を読む", () => {
    expect(parseTstzRange('["2026-10-01 01:00:00+00","2026-10-01 02:30:00+00")')).toEqual({
      start: "2026-10-01T01:00:00.000Z",
      end: "2026-10-01T02:30:00.000Z",
    });
    expect(parseTstzRange('["2026-10-01 10:00:00+09","2026-10-01 11:00:00+09")').start).toBe(
      "2026-10-01T01:00:00.000Z",
    );
    expect(parseTstzRange("[2026-10-01T01:00:00.000Z,2026-10-01T02:00:00.000Z)").end).toBe(
      "2026-10-01T02:00:00.000Z",
    );
  });

  it("半開区間以外や不正な値は受け付けない", () => {
    expect(() => parseTstzRange('("2026-10-01 01:00:00+00","2026-10-01 02:00:00+00"]')).toThrow();
    expect(() => parseTstzRange("empty")).toThrow();
  });

  it("書き出す", () => {
    expect(toTstzRange("2026-10-01T10:00:00+09:00", "2026-10-01T11:00:00+09:00")).toBe(
      "[2026-10-01T01:00:00.000Z,2026-10-01T02:00:00.000Z)",
    );
  });
});
