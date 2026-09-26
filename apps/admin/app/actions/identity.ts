"use server";

import { redirect } from "next/navigation";
import { fieldErrors, identityErrorMessage, identityReviewSchema } from "@thippo/core";
import type { FormState } from "@thippo/auth";
import { recordAudit, requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { sendTemplatedEmail } from "@thippo/mail/send";

const SIGNED_URL_SECONDS = 60;

export interface DocumentFileLink {
  side: "front" | "back";
  url: string;
}

/**
 * 本人確認書類を表示する。有効期限の短い署名付き URL を発行し、閲覧したことを audit_logs に記録する（SPEC §3.3）。
 */
export async function viewIdentityDocumentAction(
  documentId: string,
): Promise<{ files?: DocumentFileLink[]; error?: string }> {
  const { supabase, userId } = await requireAppSession("admin");
  // admin の権限（RLS）で読めることを確かめてから、service role で署名付き URL を作る
  const { data: doc } = await supabase
    .from("identity_documents")
    .select("id, user_id, front_path, back_path, purged_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "書類が見つかりません。" };
  if (doc.purged_at) return { error: "この書類は保存期間を過ぎたため削除されています。" };

  await recordAudit({
    actorId: userId,
    action: "identity.document_viewed",
    targetTable: "identity_documents",
    targetId: doc.id,
    payload: { user_id: doc.user_id, expires_in_seconds: SIGNED_URL_SECONDS },
  });

  const service = createSupabaseServiceClient();
  const files: DocumentFileLink[] = [];
  for (const [side, path] of [
    ["front", doc.front_path],
    ["back", doc.back_path],
  ] as const) {
    if (!path) continue;
    const { data, error } = await service.storage
      .from("identity-documents")
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data) return { error: "書類の表示に失敗しました。" };
    files.push({ side, url: data.signedUrl });
  }
  return { files };
}

export async function reviewIdentityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const parsed = identityReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const approve = input.decision === "approve";
  const reason = input.decision === "reject" ? input.rejectReason : undefined;
  const backSideRequested = input.decision === "reject" && input.requestBackSide === "on";

  // 審査と操作ログの記録は DB 関数の中で1つのトランザクションとして行う
  const { error } = await supabase.rpc("review_identity_document", {
    p_document_id: input.documentId,
    p_approve: approve,
    p_reject_reason: reason,
    p_request_back_side: backSideRequested,
  });
  if (error) return { error: identityErrorMessage(error.message) };

  const { data: doc } = await supabase
    .from("identity_documents")
    .select("user_id, profiles!identity_documents_user_id_fkey(email, display_name)")
    .eq("id", input.documentId)
    .single();
  const profile = doc?.profiles as
    { email: string; display_name: string | null } | null | undefined;
  if (doc && profile) {
    const name = profile.display_name ?? "お客";
    if (approve) {
      await sendTemplatedEmail({
        template: "identityApproved",
        to: profile.email,
        userId: doc.user_id,
        data: { name },
        idempotencyKey: `identity.approved:${input.documentId}`,
      });
    } else {
      await sendTemplatedEmail({
        template: "identityRejected",
        to: profile.email,
        userId: doc.user_id,
        data: { name, reason: reason ?? "", backSideRequested },
        idempotencyKey: `identity.rejected:${input.documentId}`,
      });
    }
  }
  redirect(`/identity?reviewed=${approve ? "approved" : "rejected"}`);
}
