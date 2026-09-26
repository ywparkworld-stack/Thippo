import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@thippo/observability";

/** サーバー側のエラー監視（Sentry）。DSN がなければ何もしない */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions("host"));
  }
}

export const onRequestError = Sentry.captureRequestError;
