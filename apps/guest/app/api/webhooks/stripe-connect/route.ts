import { handleConnectEvent, handleStripeWebhook } from "@thippo/payments/server";

/**
 * Stripe Connect の Webhook（連結アカウントのイベント。account.updated など）。
 * Stripe のダッシュボードで「連結アカウントのイベント」を受け取るエンドポイントとして登録する。
 */
export async function POST(request: Request) {
  const body = await request.text();
  const result = await handleStripeWebhook(
    body,
    request.headers.get("stripe-signature"),
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    handleConnectEvent,
  );
  return new Response(result.body, { status: result.status });
}
