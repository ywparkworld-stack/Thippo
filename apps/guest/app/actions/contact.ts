"use server";

import { redirect } from "next/navigation";
import { CONTACT_CATEGORIES, contactSchema, fieldErrors } from "@thippo/core";
import { RATE_LIMITED_MESSAGE, type FormState } from "@thippo/auth";
import { consumeRateLimit, createClient, loadSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { sendTemplatedEmail } from "@thippo/mail/send";

/** お問い合わせ（付録 D32）。DB に保存し、お問い合わせ先に転送し、送信者に受付メールを送る */
export async function submitContactAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  const c = parsed.data;
  const limit = await consumeRateLimit("contact", c.email);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE, values: raw };

  const session = await loadSession(await createClient());
  const userId = session?.role === "guest" ? session.userId : null;
  const { data, error } = await createSupabaseServiceClient()
    .from("contact_messages")
    .insert({ user_id: userId, name: c.name, email: c.email, category: c.category, body: c.body })
    .select("id")
    .single();
  if (error || !data)
    return { error: "送信に失敗しました。時間をおいてもう一度お試しください。", values: raw };

  // TODO(要確認): お問い合わせ先のメールアドレス（SPEC §16）
  const to = process.env.CONTACT_EMAIL;
  if (to) {
    await sendTemplatedEmail({
      template: "contactForward",
      to,
      userId: null,
      data: {
        id: data.id,
        name: c.name,
        email: c.email,
        category: CONTACT_CATEGORIES[c.category],
        body: c.body,
        userId,
      },
      idempotencyKey: `contact.forward:${data.id}`,
    });
  } else {
    console.warn("[contact] CONTACT_EMAIL is not set; the message is stored only");
  }
  await sendTemplatedEmail({
    template: "contactReceived",
    to: c.email,
    userId,
    data: { name: c.name, body: c.body },
    idempotencyKey: `contact.received:${data.id}`,
  });
  redirect("/contact/done");
}
