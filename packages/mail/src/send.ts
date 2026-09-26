import "server-only";
import type { Mailer } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { mailerFromEnv } from "./mailers";
import { templates, type TemplateContext, type TemplateData, type TemplateName } from "./templates";

export function templateContext(env: NodeJS.ProcessEnv = process.env): TemplateContext {
  const guestUrl = (env.NEXT_PUBLIC_GUEST_URL ?? "").replace(/\/+$/, "");
  return { guestUrl, contactUrl: `${guestUrl}/contact` };
}

/**
 * テンプレートからメールを作って送り、notifications に記録する（SPEC §4）。
 * 送信に失敗しても例外にはせず、notifications に failed として残す（呼び出し元の処理は巻き戻さない）。
 */
export async function sendTemplatedEmail<T extends TemplateName>(input: {
  template: T;
  to: string;
  userId: string | null;
  data: TemplateData<T>;
  /** 同じ通知を二重に送らないためのキー（例: "identity.rejected:<document_id>"） */
  idempotencyKey?: string;
  mailer?: Mailer;
}): Promise<{ ok: boolean; notificationId: string | null }> {
  const render = templates[input.template] as (
    ctx: TemplateContext,
    data: TemplateData<T>,
  ) => {
    subject: string;
    text: string;
  };
  const { subject, text } = render(templateContext(), input.data);
  const service = createSupabaseServiceClient();

  const { data: row, error: insertError } = await service
    .from("notifications")
    .insert({
      user_id: input.userId,
      to_email: input.to,
      template: input.template,
      subject,
      payload: { idempotency_key: input.idempotencyKey ?? null },
    })
    .select("id")
    .single();
  if (insertError) console.error(`[mail] failed to record notification: ${insertError.message}`);
  const notificationId = row?.id ?? null;

  try {
    const mailer = input.mailer ?? mailerFromEnv();
    const { id } = await mailer.send({
      to: input.to,
      subject,
      text,
      idempotencyKey: input.idempotencyKey,
    });
    if (notificationId) {
      await service
        .from("notifications")
        .update({ status: "sent", provider_message_id: id, sent_at: new Date().toISOString() })
        .eq("id", notificationId);
    }
    return { ok: true, notificationId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[mail] failed to send ${input.template}: ${message}`);
    if (notificationId) {
      await service
        .from("notifications")
        .update({ status: "failed", error: message.slice(0, 1000) })
        .eq("id", notificationId);
    }
    return { ok: false, notificationId };
  }
}
