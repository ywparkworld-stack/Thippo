"use server";

import { redirect } from "next/navigation";
import { fieldErrors, hostApplicationSchema } from "@thippo/core";
import { RATE_LIMITED_MESSAGE, type FormState } from "@thippo/auth";
import { consumeRateLimit } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { sendTemplatedEmail } from "@thippo/mail/send";

/** 貸出主の掲載申込（SPEC §6）。host_applications に保存し、運営に通知する */
export async function submitHostApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const { agreeTerms: _agree, ...values } = raw;
  const parsed = hostApplicationSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const a = parsed.data;

  const limit = await consumeRateLimit("hostApplication", a.email);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE, values };

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("host_applications")
    .insert({
      company_name: a.companyName,
      contact_name: a.contactName,
      email: a.email,
      phone: a.phone,
      address: a.address,
      note: a.note ?? null,
    })
    .select("id")
    .single();
  if (error || !data)
    return { error: "送信に失敗しました。時間をおいてもう一度お試しください。", values };

  await sendTemplatedEmail({
    template: "hostApplicationReceived",
    to: a.email,
    userId: null,
    data: { contactName: a.contactName, companyName: a.companyName },
    idempotencyKey: `host_application.received:${data.id}`,
  });
  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminTo) {
    await sendTemplatedEmail({
      template: "hostApplicationAdminNotice",
      to: adminTo,
      userId: null,
      data: { ...a, note: a.note ?? "" },
      idempotencyKey: `host_application.admin:${data.id}`,
    });
  } else {
    console.warn("[host application] ADMIN_NOTIFICATION_EMAIL is not set");
  }
  redirect("/hosts/apply/done");
}
