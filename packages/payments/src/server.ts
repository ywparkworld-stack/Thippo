import "server-only";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { STRIPE_CONNECT } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { accountFlags } from "./accounts";

export { accountFlags, onboardingState } from "./accounts";

/** API バージョンは固定する（SDK を更新するときにあわせて見直す） */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let client: Stripe | null = null;

/** ビルド時にキーがなくても落ちないよう、使うときに作る */
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      maxNetworkRetries: 2,
      appInfo: { name: "thippo" },
    });
  }
  return client;
}

/**
 * すべての Stripe API 呼び出しに idempotencyKey を付ける（SPEC §7-6）。
 * 同じ操作のやり直しで同じ結果になるよう、操作ごとに決まるキーを渡す。
 */
export function idempotencyKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

/** 1回限りの操作（リンクの発行など）用のキー */
export function oneTimeKey(prefix: string): string {
  return `${prefix}:${randomUUID()}`;
}

/**
 * 貸出主の Connect（Express）アカウントを作る。法人・個人事業主のどちらでも登録できるよう、事業形態は指定しない（D14）。
 * 入金は月次・毎月23日（D15）。
 */
export async function createConnectAccount(host: {
  id: string;
  email: string;
  companyName: string;
}) {
  return stripe().accounts.create(
    {
      type: "express",
      country: STRIPE_CONNECT.country,
      email: host.email,
      default_currency: STRIPE_CONNECT.currency,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: {
        name: host.companyName,
        product_description: "会議室・空き部屋の時間貸し",
      },
      settings: {
        payouts: {
          schedule: { interval: "monthly", monthly_anchor: STRIPE_CONNECT.payoutMonthlyAnchor },
        },
      },
      metadata: { host_id: host.id },
    },
    { idempotencyKey: idempotencyKey("connect-account", host.id) },
  );
}

export async function createOnboardingLink(accountId: string, hostUrl: string) {
  return stripe().accountLinks.create(
    {
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${hostUrl}/onboarding/stripe/refresh`,
      return_url: `${hostUrl}/onboarding/stripe/return`,
      collection_options: { fields: "eventually_due" },
    },
    { idempotencyKey: oneTimeKey("account-link") },
  );
}

export async function createDashboardLink(accountId: string) {
  return stripe().accounts.createLoginLink(
    accountId,
    {},
    { idempotencyKey: oneTimeKey("login-link") },
  );
}

/** Stripe のアカウントの状態を hosts に反映する（オンボーディングから戻ったとき・account.updated を受けたとき） */
export async function syncConnectAccount(account: Stripe.Account): Promise<void> {
  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("hosts")
    .update(accountFlags(account))
    .eq("stripe_account_id", account.id);
  if (error) throw new Error(`failed to sync Stripe account ${account.id}: ${error.message}`);
}

export async function retrieveAndSyncAccount(accountId: string): Promise<Stripe.Account> {
  const account = await stripe().accounts.retrieve(accountId);
  await syncConnectAccount(account);
  return account;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type WebhookResult = { status: number; body: string };

/**
 * Webhook を受け取る共通の処理。署名を検証し、stripe_events で同じイベントを二重に処理しないようにする（SPEC §7-5）。
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
  handler: (event: Stripe.Event) => Promise<void>,
): Promise<WebhookResult> {
  if (!secret) return { status: 500, body: "webhook secret is not configured" };
  if (!signature) return { status: 400, body: "missing signature" };

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return { status: 400, body: "invalid signature" };
  }

  const service = createSupabaseServiceClient();
  const { data: claimed, error } = await service.rpc("claim_stripe_event", {
    p_event_id: event.id,
    p_type: event.type,
    p_payload: JSON.parse(rawBody),
  });
  if (error) return { status: 500, body: "failed to record event" };
  // 処理済み・処理中のイベントは 200 を返して再送を止める
  if (!claimed) return { status: 200, body: "duplicate" };

  try {
    await handler(event);
    await service.rpc("complete_stripe_event", { p_event_id: event.id });
    return { status: 200, body: "ok" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[stripe webhook] ${event.type} ${event.id} failed: ${message}`);
    await service.rpc("complete_stripe_event", {
      p_event_id: event.id,
      p_error: message.slice(0, 1000),
    });
    // 500 を返すと Stripe が再送する
    return { status: 500, body: "handler failed" };
  }
}

/** Connect のイベント（連結アカウントで起きたもの） */
export async function handleConnectEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "account.updated":
      await syncConnectAccount(event.data.object);
      return;
    default:
      return;
  }
}
