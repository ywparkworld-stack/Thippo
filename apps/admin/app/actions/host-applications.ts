"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors } from "@thippo/core";
import type { FormState } from "@thippo/auth";
import { requireAppSession } from "@thippo/auth/server";
import { appUrl } from "@thippo/auth/urls";
import { createSupabaseServiceClient } from "@thippo/db/admin";

const MESSAGES: Record<string, string> = {
  application_not_found: "申込が見つかりません。",
  application_not_pending: "この申込はすでに審査済みです。",
  email_already_registered:
    "このメールアドレスはすでに thippo のアカウントとして使われています。申込者に別のメールアドレスを依頼してください。",
  invalid_invitee: "招待したアカウントと申込のメールアドレスが一致しません。",
  reject_reason_required: "却下の理由を入力してください。",
  not_allowed: "この操作を行う権限がありません。",
};
const toMessage = (m?: string) =>
  Object.entries(MESSAGES).find(([k]) => m?.includes(k))?.[1] ??
  "処理に失敗しました。時間をおいてもう一度お試しください。";

const idSchema = z.object({ applicationId: z.uuid() });

/**
 * 掲載申込の承認（SPEC §10）。担当者を Supabase Auth で招待し（招待メール = 承認の通知）、
 * DB 関数で貸出主と担当者を作る。DB 関数が失敗したら、招待したアカウントを消して元に戻す。
 */
export async function approveHostApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "申込が見つかりません。" };

  const { data: app } = await supabase
    .from("host_applications")
    .select("id, email, contact_name, status")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();
  if (!app) return { error: MESSAGES.application_not_found };
  if (app.status !== "pending") return { error: MESSAGES.application_not_pending };

  // 利用者として登録済みのメールアドレスは使えない（付録 D6・D13）
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", app.email.toLowerCase())
    .limit(1);
  if (existing && existing.length > 0) return { error: MESSAGES.email_already_registered };

  const service = createSupabaseServiceClient();
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    app.email,
    {
      redirectTo: appUrl("host"),
      data: { display_name: app.contact_name },
    },
  );
  if (inviteError || !invited.user) {
    return {
      error:
        inviteError?.code === "email_exists"
          ? MESSAGES.email_already_registered
          : "招待メールを送れませんでした。時間をおいてもう一度お試しください。",
    };
  }

  const { error } = await supabase.rpc("approve_host_application", {
    p_application_id: app.id,
    p_user_id: invited.user.id,
  });
  if (error) {
    // 招待したアカウントを消す（profiles は auth.users を参照しているため先に消す）
    await service.from("profiles").delete().eq("id", invited.user.id).eq("role", "guest");
    await service.auth.admin.deleteUser(invited.user.id);
    return { error: toMessage(error.message) };
  }
  redirect("/host-applications?reviewed=approved");
}

const rejectSchema = z.object({
  applicationId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "却下の理由を入力してください")
    .max(1000, "1000文字以内にしてください"),
});

export async function rejectHostApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase.rpc("reject_host_application", {
    p_application_id: parsed.data.applicationId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: toMessage(error.message) };
  redirect("/host-applications?reviewed=rejected");
}
