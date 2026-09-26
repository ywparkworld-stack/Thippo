import type { NextConfig } from "next";

/** 3アプリ共通の Next.js 設定。 */
export function baseNextConfig(extraHeaders: { key: string; value: string }[] = []): NextConfig {
  return {
    transpilePackages: [
      "@thippo/auth",
      "@thippo/core",
      "@thippo/db",
      "@thippo/invoice",
      "@thippo/mail",
      "@thippo/payments",
      "@thippo/ui",
    ],
    poweredByHeader: false,
    // PDF の作成（pdfkit）はフォントなどのファイルを実行時に読むため、バンドルしない
    serverExternalPackages: ["pdfkit", "@expo-google-fonts/noto-sans-jp"],
    outputFileTracingIncludes: {
      "/**": [
        "../../node_modules/.pnpm/@expo-google-fonts+noto-sans-jp@*/node_modules/@expo-google-fonts/noto-sans-jp/{400Regular,700Bold}/*.ttf",
      ],
    },
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
