"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@thippo/auth";
import { requireAppSession } from "@thippo/auth/server";
import { issueMonthlyStatement } from "@thippo/invoice/statements";
import { sendBookingCancelledEmails, sendRefundCompletedEmail } from "@thippo/mail/booking-emails";
import {
  CANCEL_ERROR_MESSAGES,
  cancelBookingAndRefund,
  cancelErrorCode,
  executeRefund,
} from "@thippo/payments/refunds";

const reason = z
  .string()
  .trim()
  .min(1, "理由を入力してください")
  .max(1000, "理由は1000文字以内にしてください");

const MESSAGES: Record<string, string> = {
  reason_required: "理由を入力してください。",
  cannot_change_admin: "運営のアカウントは停止できません。",
  not_allowed: "この操作を行う権限がありません（2段階認証をやり直してください）。",
  user_not_found: "利用者が見つかりません。",
  host_not_found: "貸出主が見つかりません。",
  space_not_found: "スペースが見つかりません。",
};
const toMessage = (m?: string) =>
  Object.entries(MESSAGES).find(([k]) => m?.includes(k))?.[1] ??
  "処理に失敗しました。時間をおいてもう一度お試しください。";

export async function setUserStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const p = z
    .object({ userId: z.uuid(), status: z.enum(["active", "suspended"]), reason })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { error } = await supabase.rpc("admin_set_profile_status", {
    p_user_id: p.data.userId,
    p_status: p.data.status,
    p_reason: p.data.reason,
  });
  if (error) return { error: toMessage(error.message) };
  revalidatePath(`/users/${p.data.userId}`);
  return {
    message:
      p.data.status === "suspended" ? "アカウントを停止しました。" : "アカウントを再開しました。",
  };
}

export async function setHostStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const p = z
    .object({ hostId: z.uuid(), status: z.enum(["active", "suspended"]), reason })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { data, error } = await supabase.rpc("admin_set_host_status", {
    p_host_id: p.data.hostId,
    p_status: p.data.status,
    p_reason: p.data.reason,
  });
  if (error) return { error: toMessage(error.message) };
  revalidatePath(`/hosts/${p.data.hostId}`);
  return {
    message:
      p.data.status === "suspended"
        ? `貸出主を停止しました。公開中だったスペース${data ?? 0}件を非公開にしました。`
        : "貸出主を再開しました。スペースは貸出主が公開し直す必要があります。",
  };
}

export async function setSpaceSuspendedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const p = z
    .object({ spaceId: z.uuid(), hostId: z.uuid(), suspended: z.enum(["true", "false"]), reason })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const { error } = await supabase.rpc("admin_set_space_suspended", {
    p_space_id: p.data.spaceId,
    p_suspended: p.data.suspended === "true",
    p_reason: p.data.reason,
  });
  if (error) return { error: toMessage(error.message) };
  revalidatePath(`/hosts/${p.data.hostId}`);
  return {
    message:
      p.data.suspended === "true"
        ? "公開停止にしました。"
        : "公開停止を解除しました（非公開の状態）。",
  };
}

/** 運営判断での全額返金（予約をキャンセルし、利用者に全額返金する。理由必須・操作ログは DB 関数で記録） */
export async function adminRefundBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await requireAppSession("admin");
  const p = z
    .object({ bookingId: z.uuid(), orderId: z.uuid(), reason })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message };
  try {
    const r = await cancelBookingAndRefund({
      bookingId: p.data.bookingId,
      actor: "admin",
      actorId: userId,
      reason: p.data.reason,
    });
    await sendBookingCancelledEmails(p.data.bookingId, r.refundAmount);
    if (r.refundCompleted) await sendRefundCompletedEmail(r.refundId);
    revalidatePath(`/orders/${p.data.orderId}`);
    return {
      message: r.refundSubmitted
        ? "キャンセルし、全額返金を依頼しました。"
        : "キャンセルしましたが、返金の処理に失敗しました。再実行してください。",
    };
  } catch (e) {
    const code = cancelErrorCode((e as Error).message);
    return { error: CANCEL_ERROR_MESSAGES[code] ?? "キャンセルに失敗しました。" };
  }
}

/** 失敗した返金の再実行（SPEC §8.1・§10） */
export async function retryRefundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const refundId = z.uuid().safeParse(formData.get("refundId"));
  if (!refundId.success) return { error: "返金が見つかりません。" };
  const { error: auditError } = await supabase.rpc("admin_record_action", {
    p_action: "admin.refund_retry",
    p_target_table: "refunds",
    p_target_id: refundId.data,
    p_payload: {},
  });
  if (auditError) return { error: toMessage(auditError.message) };
  const r = await executeRefund(refundId.data);
  if (r.completed) await sendRefundCompletedEmail(refundId.data);
  revalidatePath("/refunds");
  return r.ok
    ? { message: "返金を再実行しました。" }
    : { error: "返金に失敗しました。Stripe の画面で理由を確認してください。" };
}

/** 月次明細と請求書の発行（SPEC §10）。発行は1か月に1回 */
export async function issueStatementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireAppSession("admin");
  const p = z
    .object({ hostId: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "入力が正しくありません。" };
  const { error: auditError } = await supabase.rpc("admin_record_action", {
    p_action: "admin.statement_issue",
    p_target_table: "hosts",
    p_target_id: p.data.hostId,
    p_payload: { month: p.data.month },
  });
  if (auditError) return { error: toMessage(auditError.message) };
  try {
    await issueMonthlyStatement(p.data.hostId, p.data.month);
  } catch (e) {
    return {
      error:
        (e as Error).message === "already_issued"
          ? "この月の明細は発行済みです。"
          : "発行に失敗しました。",
    };
  }
  revalidatePath("/statements");
  return { message: "月次明細と請求書を発行しました。" };
}
