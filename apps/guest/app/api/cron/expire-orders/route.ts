import { timingSafeEqual } from "node:crypto";
import { expireDueOrders } from "@thippo/payments/checkout";

/**
 * 15分以上 pending の注文を expired にして枠を解放し、PaymentIntent を取り消す（SPEC §7-4・§11、付録 D8）。
 * 定期実行（5分ごと）から呼ぶ。スケジュールの設定はフェーズ10。
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await expireDueOrders();
  return Response.json(result);
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
