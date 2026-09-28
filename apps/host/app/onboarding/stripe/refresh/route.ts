import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@thippo/auth/urls";
import { isStubId } from "@thippo/payments";
import { createOnboardingLink } from "@thippo/payments/server";
import { requireHost } from "../../../lib/host";

/** オンボーディングのリンクの期限が切れたとき。新しいリンクを発行してやり直す */
export async function GET(request: NextRequest) {
  const { host } = await requireHost("/onboarding");
  if (!host.stripe_account_id || isStubId(host.stripe_account_id))
    return NextResponse.redirect(new URL("/onboarding", request.url));
  const link = await createOnboardingLink(host.stripe_account_id, appUrl("host"));
  return NextResponse.redirect(link.url);
}
