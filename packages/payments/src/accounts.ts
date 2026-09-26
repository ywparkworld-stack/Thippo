import type Stripe from "stripe";

/** Stripe の Connect アカウントの状態のうち、hosts に保存するもの */
export interface AccountFlags {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

export function accountFlags(
  account: Pick<Stripe.Account, "charges_enabled" | "payouts_enabled" | "details_submitted">,
): AccountFlags {
  return {
    charges_enabled: account.charges_enabled === true,
    payouts_enabled: account.payouts_enabled === true,
    details_submitted: account.details_submitted === true,
  };
}

export type OnboardingState = "not_started" | "in_progress" | "pending_verification" | "complete";

/** 貸出主センターに表示するオンボーディングの状態。complete になるまでスペースを公開できない（SPEC §9） */
export function onboardingState(host: {
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}): OnboardingState {
  if (!host.stripe_account_id) return "not_started";
  if (host.charges_enabled && host.payouts_enabled) return "complete";
  if (host.details_submitted) return "pending_verification";
  return "in_progress";
}
