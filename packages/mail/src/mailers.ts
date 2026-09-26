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

export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer {
  if (env.RESEND_API_KEY && env.MAIL_FROM)
    return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM);
  if (env.APP_ENV === "development" || env.NODE_ENV === "test") return new ConsoleMailer();
  throw new Error("RESEND_API_KEY and MAIL_FROM must be set");
}
