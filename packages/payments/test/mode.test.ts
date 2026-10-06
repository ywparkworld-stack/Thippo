import { describe, expect, it } from "vitest";
import { isStubId, paymentsMode } from "../src/mode";

describe("paymentsMode（付録 D37）", () => {
  it("指定がなければ、Stripe のキーがあるときは stripe、ないときは stub（D39）", () => {
    expect(paymentsMode({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe("stripe");
    expect(paymentsMode({})).toBe("stub");
    expect(() => paymentsMode({ APP_ENV: "production" })).toThrow(/production/);
    expect(paymentsMode({ PAYMENTS_MODE: " Stub " })).toBe("stub");
  });

  it("本番では stub を使えない", () => {
    expect(() => paymentsMode({ PAYMENTS_MODE: "stub", APP_ENV: "production" })).toThrow(
      /production/,
    );
    expect(paymentsMode({ PAYMENTS_MODE: "stripe", APP_ENV: "production" })).toBe("stripe");
  });

  it("知らない値は例外にする", () => {
    expect(() => paymentsMode({ PAYMENTS_MODE: "fake" })).toThrow();
  });

  it("stub の id を見分ける", () => {
    expect(isStubId("pi_stub_1")).toBe(true);
    expect(isStubId("acct_stub_1")).toBe(true);
    expect(isStubId("pi_3Nstub")).toBe(false);
    expect(isStubId(null)).toBe(false);
  });
});
