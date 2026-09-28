import { handleStripeWebhook } from "@thippo/payments/server";
import { handlePlatformEvent } from "../../../lib/payments";

/**
 * Stripe の Webhook（プラットフォームのイベント。payment_intent.succeeded など）。
 * 署名を検証し、stripe_events で同じイベントを二重に処理しない（SPEC §7-5）。
 */
export async function POST(request: Request) {
  const body = await request.text();
  const result = await handleStripeWebhook(
    body,
    request.headers.get("stripe-signature"),
    process.env.STRIPE_WEBHOOK_SECRET,
    handlePlatformEvent,
  );
  return new Response(result.body, { status: result.status });
}
