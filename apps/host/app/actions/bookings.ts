"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RATE_LIMITED_MESSAGE, type FormState } from "@thippo/auth";
import { consumeRateLimit } from "@thippo/auth/server";
import { sendBookingCancelledEmails, sendRefundCompletedEmail } from "@thippo/mail/booking-emails";
import {
  CANCEL_ERROR_MESSAGES,
  cancelBookingAndRefund,
  cancelErrorCode,
} from "@thippo/payments/refunds";
import { requireHost } from "../lib/host";

const cancelSchema = z.object({
  bookingId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "キャンセルの理由を入力してください")
    .max(1000, "理由は1000文字以内にしてください"),
});

/** 貸出主都合のキャンセル（理由の入力が必須。常に全額返金。SPEC §8・§9） */
export async function hostCancelBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await requireHost();
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: { reason: parsed.error.issues[0]?.message ?? "" } };
  const limit = await consumeRateLimit("cancel", userId);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE };
  try {
    const result = await cancelBookingAndRefund({
      bookingId: parsed.data.bookingId,
      actor: "host",
      actorId: userId,
      reason: parsed.data.reason,
    });
    await sendBookingCancelledEmails(parsed.data.bookingId, result.refundAmount);
    if (result.refundCompleted) await sendRefundCompletedEmail(result.refundId);
  } catch (e) {
    const code = cancelErrorCode((e as Error).message);
    if (code === "unknown") console.error(`[host cancel] ${(e as Error).message}`);
    return {
      error:
        CANCEL_ERROR_MESSAGES[code] ??
        "キャンセルに失敗しました。時間をおいてもう一度お試しください。",
    };
  }
  redirect(`/bookings/${parsed.data.bookingId}?cancelled=1`);
}

/** 無断キャンセルの記録（利用開始後。返金なし） */
export async function recordNoShowAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireHost();
  const bookingId = z.uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return { error: "予約が見つかりません。" };
  const { error } = await supabase.rpc("record_no_show", { p_booking_id: bookingId.data });
  if (error) {
    return {
      error: error.message.includes("booking_not_started")
        ? "無断キャンセルは利用開始時刻を過ぎてから記録できます。"
        : "記録できませんでした（確定済みの予約だけが対象です）。",
    };
  }
  revalidatePath(`/bookings/${bookingId.data}`);
  return { message: "無断キャンセルとして記録しました。" };
}
