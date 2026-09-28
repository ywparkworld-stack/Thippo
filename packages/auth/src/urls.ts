import type { AppName } from "./apps";

/**
 * 各アプリの公開 URL（メールのリンクの戻り先に使う）。本番のドメインは環境変数で切り替える。
 * TODO(要確認): 本番のドメイン（SPEC §16）。
 */
export function appUrl(app: AppName): string {
  const value =
    app === "guest"
      ? process.env.NEXT_PUBLIC_GUEST_URL
      : app === "host"
        ? process.env.NEXT_PUBLIC_HOST_URL
        : process.env.ADMIN_URL;
  if (!value) throw new Error(`URL for ${app} app is not configured`);
  return value.replace(/\/+$/, "");
}
