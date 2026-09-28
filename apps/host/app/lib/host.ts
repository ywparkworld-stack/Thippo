import "server-only";
import { redirect } from "next/navigation";
import { requireAppSession } from "@thippo/auth/server";

/** ログイン中の担当者と、その所属する貸出主（企業）。担当者は1つの貸出主にだけ所属する */
export async function requireHost(next?: string) {
  const session = await requireAppSession("host", next);
  const { data: host } = await session.supabase
    .from("hosts")
    .select(
      "id, company_name, invoice_registration_number, address, phone, status, stripe_account_id, charges_enabled, payouts_enabled, details_submitted",
    )
    .maybeSingle();
  if (!host) redirect("/login?error=forbidden");
  return { ...session, host };
}

export type HostContext = Awaited<ReturnType<typeof requireHost>>;
