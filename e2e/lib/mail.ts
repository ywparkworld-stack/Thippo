import { env } from "./env";

/** Mailpit（supabase start に含まれる）から、宛先に届いた最新のメールの本文を取る */
export async function waitForMail(
  to: string,
  subjectIncludes: string,
  timeoutMs = 60_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${env.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    if (res.ok) {
      const json = (await res.json()) as { messages?: { ID: string; Subject: string }[] };
      const msg = json.messages?.find((m) => m.Subject.includes(subjectIncludes));
      if (msg) {
        const detail = (await (await fetch(`${env.mailUrl}/api/v1/message/${msg.ID}`)).json()) as {
          HTML: string;
          Text: string;
        };
        return detail.HTML || detail.Text;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`mail to ${to} (${subjectIncludes}) did not arrive`);
}

export function firstLink(html: string, contains: string): string {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&"));
  const link = links.find((l) => l.includes(contains));
  if (!link) throw new Error(`no link containing ${contains}`);
  return link;
}

/**
 * アプリが送るメール（Resend）は E2E では送らず notifications に記録される（ConsoleMailer）。
 * その記録で、送ったことを確かめる。
 */
export async function waitForNotification(
  to: string,
  template: string,
  timeoutMs = 60_000,
): Promise<void> {
  const { withDb } = await import("./db");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await withDb((db) =>
      db.query(
        "select 1 from public.notifications where to_email = $1 and template = $2 and status = 'sent'",
        [to, template],
      ),
    );
    if (found.rowCount) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`notification ${template} to ${to} was not sent`);
}
