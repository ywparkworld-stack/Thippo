/**
 * Sentry の共通設定（SPEC §2 エラー監視）。3アプリの instrumentation から使う。
 * DSN（NEXT_PUBLIC_SENTRY_DSN）がなければ送らない（ローカル・テスト）。
 * 個人情報・秘密情報を送らないよう、cookie・認証ヘッダー・メールのリンクのトークンなどを消してから送る。
 */
export type AppName = "guest" | "host" | "admin";

type SentryEvent = {
  request?: {
    cookies?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
    data?: unknown;
    url?: string;
  };
  user?: { id?: string | number; email?: string; ip_address?: string | null; username?: string };
  tags?: Record<string, unknown>;
};

const SENSITIVE_HEADERS = [
  "cookie",
  "authorization",
  "stripe-signature",
  "cf-access-jwt-assertion",
  "x-forwarded-for",
  "x-real-ip",
];
const SENSITIVE_QUERY = /([?&](token_hash|code|token|access_token|refresh_token)=)[^&#]*/gi;

export function scrubEvent<E extends SentryEvent>(event: E): E {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete event.request.headers[key];
      }
    }
    if (typeof event.request.query_string === "string") {
      event.request.query_string = `?${event.request.query_string}`
        .replace(SENSITIVE_QUERY, "$1[Filtered]")
        .slice(1);
    } else {
      delete event.request.query_string;
    }
    if (event.request.url)
      event.request.url = event.request.url.replace(SENSITIVE_QUERY, "$1[Filtered]");
  }
  // 利用者は id だけ送る（メールアドレス・IP アドレスは送らない）
  if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  return event;
}

export function sentryOptions(app: AppName) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "development",
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    sendDefaultPii: false,
    initialScope: { tags: { app } },
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
