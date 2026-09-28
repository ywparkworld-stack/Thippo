import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { AppName } from "./apps";
import { loginUrl, safeNextPath } from "./redirect";
import { createClient } from "./server";

const ALLOWED_TYPES: Record<AppName, readonly EmailOtpType[]> = {
  guest: ["email", "signup", "recovery", "email_change"],
  host: ["invite", "recovery", "email_change"],
  admin: ["recovery"],
};

/**
 * メールのリンク（/auth/confirm?token_hash=...&type=...）を確かめてセッションを作る Route Handler の中身。
 * 会員登録の確認・パスワード再設定・貸出主の招待に使う。
 */
export async function handleEmailConfirm(
  app: AppName,
  request: NextRequest,
): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fail = () =>
    NextResponse.redirect(new URL(loginUrl(undefined, "link_invalid"), request.url));

  if (!tokenHash || !type || !ALLOWED_TYPES[app].includes(type)) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return fail();

  const metaNext = (data.user.user_metadata as { next?: unknown } | undefined)?.next;
  const next = safeNextPath(
    searchParams.get("next") ?? (type === "email" || type === "signup" ? metaNext : undefined),
  );
  return NextResponse.redirect(new URL(next, request.url));
}
