"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@thippo/auth";
import { requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";

/**
 * 退会（付録 D36）。これからの予約がある間は退会できない。
 * 退会後は Auth 側でもログインを止める（ban）。本人確認書類は保存期間を過ぎたら定期実行で削除する（D33）。
 */
export async function withdrawAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireAppSession("guest", "/mypage/withdraw");
  if (formData.get("confirm") !== "on")
    return { error: "内容を確認し、チェックを入れてください。" };
  const { error } = await supabase.rpc("withdraw_account");
  if (error) {
    return {
      error: error.message.includes("has_upcoming_bookings")
        ? "これからのご予約（お支払い待ちを含む）があるため退会できません。キャンセルするか、利用後に手続きしてください。"
        : "退会できませんでした。お問い合わせください。",
    };
  }
  const service = createSupabaseServiceClient();
  const { error: banError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (banError) console.error(`[withdraw] failed to ban ${userId}: ${banError.message}`);
  await supabase.auth.signOut({ scope: "local" });
  redirect("/withdrawn");
}
