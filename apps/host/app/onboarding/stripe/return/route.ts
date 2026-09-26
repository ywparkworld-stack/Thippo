import { NextResponse, type NextRequest } from "next/server";
import { retrieveAndSyncAccount } from "@thippo/payments/server";
import { requireHost } from "../../../lib/host";

/** Stripe のオンボーディングから戻ったとき。状態を取り直して保存する（Webhook の account.updated でも更新される） */
export async function GET(request: NextRequest) {
  const { host } = await requireHost("/onboarding");
  if (host.stripe_account_id) await retrieveAndSyncAccount(host.stripe_account_id);
  return NextResponse.redirect(new URL("/onboarding?stripe=returned", request.url));
}
