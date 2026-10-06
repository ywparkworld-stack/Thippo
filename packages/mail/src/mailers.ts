import type { EmailMessage, Mailer } from "@thippo/core";

/** Resend の HTTP API で送る */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend responded ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id?: string };
    return { id: json.id ?? null };
  }
}

/** ローカル開発用。送らずにログに出す */
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<{ id: string | null }> {
    console.info(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
    return { id: null };
  }
}

/**
 * メールの送り方（付録 D39）。
 * - "resend"：Resend で送る（RESEND_API_KEY と MAIL_FROM があるとき）
 * - "console"：送らずにログに出して送信済みにする（ローカル開発・テスト）
 * - "manual"：送らずに「送信待ち」で残し、運営が運営管理の画面を見て手作業で送る（それ以外。当分の運用）
 */
export type MailMode = "resend" | "console" | "manual";

export function mailModeFromEnv(env: NodeJS.ProcessEnv = process.env): MailMode {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return "resend";
  if (env.APP_ENV === "development" || env.NODE_ENV === "test") return "console";
  return "manual";
}

/** 送り方に合った Mailer。手作業で送る場合は null（送らずに記録だけする） */
export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  switch (mailModeFromEnv(env)) {
    case "resend":
      return new ResendMailer(env.RESEND_API_KEY!, env.MAIL_FROM!);
    case "console":
      return new ConsoleMailer();
    case "manual":
      return null;
  }
}
