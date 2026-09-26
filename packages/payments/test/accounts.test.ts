import { describe, expect, it } from "vitest";
import { accountFlags, onboardingState } from "../src";

describe("onboardingState", () => {
  const host = {
    stripe_account_id: "acct_1",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
  };
  it("状態を判定する", () => {
    expect(onboardingState({ ...host, stripe_account_id: null })).toBe("not_started");
    expect(onboardingState(host)).toBe("in_progress");
    expect(onboardingState({ ...host, details_submitted: true })).toBe("pending_verification");
    expect(onboardingState({ ...host, details_submitted: true, charges_enabled: true })).toBe(
      "pending_verification",
    );
    expect(onboardingState({ ...host, charges_enabled: true, payouts_enabled: true })).toBe(
      "complete",
    );
  });

  it("Stripe のアカウントから hosts の値を作る（未定義は false）", () => {
    expect(
      accountFlags({ charges_enabled: true, payouts_enabled: false, details_submitted: true }),
    ).toEqual({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    });
  });
});
