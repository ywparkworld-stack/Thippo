import type { NextConfig } from "next";

/** 3アプリ共通の Next.js 設定。 */
export function baseNextConfig(extraHeaders: { key: string; value: string }[] = []): NextConfig {
  return {
    transpilePackages: ["@thippo/auth", "@thippo/core", "@thippo/db", "@thippo/mail", "@thippo/ui"],
    poweredByHeader: false,
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
            ...extraHeaders,
          ],
        },
      ];
    },
  };
}
