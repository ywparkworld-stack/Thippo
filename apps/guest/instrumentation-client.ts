import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@thippo/observability";

/** ブラウザ側のエラー監視（Sentry）。DSN がなければ何もしない */
Sentry.init(sentryOptions("guest"));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
