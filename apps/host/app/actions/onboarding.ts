"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors, hostProfileSchema } from "@thippo/core";
import type { FormState } from "@thippo/auth";
import { appUrl } from "@thippo/auth/urls";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import {
  createConnectAccount,
  createDashboardLink,
  createOnboardingLink,
} from "@thippo/payments/server";
import { requireHost } from "../lib/host";

export async function saveHostProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, host } = await requireHost("/onboarding");
  const parsed = hostProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase
    .from("hosts")
    .update({
      company_name: parsed.data.companyName,
      invoice_registration_number: parsed.data.invoiceRegistrationNumber,
      address: parsed.data.address,
      phone: parsed.data.phone,
    })
    .eq("id", host.id);
  if (error) return { error: "保存に失敗しました。時間をおいてもう一度お試しください。" };
  revalidatePath("/onboarding");
  return { message: "会社情報を保存しました。" };
}

/** Stripe Connect（Express）の登録を始める・続ける（SPEC §9）。アカウントがなければ作る */
export async function startStripeOnboardingAction(): Promise<void> {
  const { host, userId, supabase } = await requireHost("/onboarding");
  let accountId = host.stripe_account_id;
  if (!accountId) {
    const { data: me } = await supabase.from("profiles").select("email").eq("id", userId).single();
    const account = await createConnectAccount({
      id: host.id,
      email: me?.email ?? "",
      companyName: host.company_name,
    });
    accountId = account.id;
    // Stripe の情報はブラウザから書き換えられないよう、service role で保存する
    const service = createSupabaseServiceClient();
    const { error } = await service
      .from("hosts")
      .update({ stripe_account_id: accountId })
      .eq("id", host.id)
      .is("stripe_account_id", null);
    if (error) throw new Error(`failed to save Stripe account: ${error.message}`);
  }
  const link = await createOnboardingLink(accountId, appUrl("host"));
  redirect(link.url);
}

export async function openStripeDashboardAction(): Promise<void> {
  const { host } = await requireHost("/onboarding");
  if (!host.stripe_account_id || !host.details_submitted) redirect("/onboarding");
  const link = await createDashboardLink(host.stripe_account_id);
  redirect(link.url);
}
