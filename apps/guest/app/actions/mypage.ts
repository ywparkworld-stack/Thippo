"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  IDENTITY_FILE,
  detectFileType,
  fieldErrors,
  identityErrorMessage,
  identitySubmissionSchema,
  profileUpdateSchema,
} from "@thippo/core";
import type { FormState } from "@thippo/auth";
import { requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";

const BUCKET = "identity-documents";

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireAppSession("guest", "/mypage/profile");
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, phone: parsed.data.phone })
    .eq("id", userId);
  if (error) return { error: "保存に失敗しました。時間をおいてもう一度お試しください。" };
  revalidatePath("/mypage");
  return { message: "会員情報を保存しました。" };
}

/**
 * アップロード済みのファイルの中身を確かめる。拡張子や Content-Type は偽れるため、先頭のバイト列で判定する。
 * 受け付けないファイルはストレージから消す。
 */
async function verifyUploadedFile(path: string): Promise<boolean> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.storage.from(BUCKET).download(path);
  if (error || !data) return false;
  const ok =
    data.size > 0 &&
    data.size <= IDENTITY_FILE.maxBytes &&
    detectFileType(new Uint8Array(await data.slice(0, 16).arrayBuffer())) !== null;
  if (!ok) await service.storage.from(BUCKET).remove([path]);
  return ok;
}

export async function submitIdentityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireAppSession("guest", "/mypage/identity");
  const parsed = identitySubmissionSchema.safeParse({
    documentType: formData.get("documentType") ?? undefined,
    frontPath: formData.get("frontPath") ?? undefined,
    backPath: formData.get("backPath") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { documentType, frontPath, backPath } = parsed.data;

  // パスの持ち主は DB 関数でも確かめるが、ここでも先に確かめる（他人のファイルを読みに行かないため）
  const paths = [frontPath, backPath].filter((p): p is string => !!p);
  if (paths.some((p) => !p.startsWith(`${userId}/`)))
    return { error: identityErrorMessage("invalid_path") };
  for (const p of paths) {
    if (!(await verifyUploadedFile(p))) {
      return {
        error:
          "画像（JPEG・PNG・HEIC）または PDF のファイルを、10MB 以内でアップロードしてください。",
      };
    }
  }

  const { error } = await supabase.rpc("submit_identity_document", {
    p_document_type: documentType,
    p_front_path: frontPath,
    p_back_path: backPath,
  });
  if (error) return { error: identityErrorMessage(error.message) };
  revalidatePath("/mypage");
  redirect("/mypage/identity?submitted=1");
}
