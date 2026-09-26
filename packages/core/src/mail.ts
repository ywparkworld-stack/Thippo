/**
 * メール送信のインターフェース（SPEC §2）。実装（Resend など）は @thippo/mail にあり、差し替えられる。
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** 同じメールを二重に送らないためのキー（対応している実装だけが使う） */
  idempotencyKey?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<{ id: string | null }>;
}
