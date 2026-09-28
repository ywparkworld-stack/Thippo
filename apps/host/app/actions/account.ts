"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailSchema, fieldErrors } from "@thippo/core";
import type { FormState } from "@thippo/auth";
import { appUrl } from "@thippo/auth/urls";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { requireHost } from "../lib/host";

const schema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1, "お名前を入力してください").max(100),
});

/** 担当者の追加（SPEC §9）。招待メールを送り、DB 関数で担当者にする。利用者として登録済みのメールアドレスは使えない（D6） */
export async function addMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { host, userId } = await requireHost("/account");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const alreadyUsed =
    "このメールアドレスはすでに thippo のアカウントとして使われています。別のメールアドレスをお使いください。";

  const service = createSupabaseServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .limit(1);
  if (existing && existing.length > 0) return { error: alreadyUsed };

  const { data: invited, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: appUrl("host"),
    data: { display_name: parsed.data.displayName },
  });
  if (error || !invited.user) {
    return {
      error: error?.code === "email_exists" ? alreadyUsed : "招待メールを送れませんでした。",
    };
  }
  const { error: addError } = await service.rpc("add_host_member", {
    p_host_id: host.id,
    p_inviter_id: userId,
    p_user_id: invited.user.id,
  });
  if (addError) {
    await service.from("profiles").delete().eq("id", invited.user.id).eq("role", "guest");
    await service.auth.admin.deleteUser(invited.user.id);
    return {
      error: addError.message.includes("email_already_registered")
        ? alreadyUsed
        : "担当者を追加できませんでした。",
    };
  }
  revalidatePath("/account");
  return { message: `${parsed.data.email} に招待メールを送りました。` };
}
