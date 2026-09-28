"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { RATE_LIMITED_MESSAGE, type FormState } from "@thippo/auth";
import { consumeRateLimit, requireAppSession } from "@thippo/auth/server";
import { sendBookingCancelledEmails, sendRefundCompletedEmail } from "@thippo/mail/booking-emails";
import {
  CANCEL_ERROR_MESSAGES,
  cancelBookingAndRefund,
  cancelErrorCode,
} from "@thippo/payments/refunds";

/** 利用者のキャンセル（SPEC §8。予約ごと: 付録 D4）。レート制限をかける（SPEC §3.3） */
export async function cancelBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await requireAppSession("guest", "/mypage/orders");
  const bookingId = z.uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return { error: CANCEL_ERROR_MESSAGES.booking_not_found };
  if (formData.get("confirm") !== "on")
    return { error: "内容を確認し、チェックを入れてください。" };

  const limit = await consumeRateLimit("cancel", userId);
  if (!limit.ok) return { error: RATE_LIMITED_MESSAGE };

  let orderId: string;
  try {
    const result = await cancelBookingAndRefund({
      bookingId: bookingId.data,
      actor: "guest",
      actorId: userId,
    });
    await sendBookingCancelledEmails(bookingId.data, result.refundAmount);
    if (result.refundCompleted) await sendRefundCompletedEmail(result.refundId);
    orderId = String(formData.get("orderId") ?? "");
  } catch (e) {
    const code = cancelErrorCode((e as Error).message);
    if (code === "unknown") console.error(`[cancel] ${(e as Error).message}`);
    return {
      error:
        CANCEL_ERROR_MESSAGES[code] ??
        "キャンセルに失敗しました。時間をおいてもう一度お試しください。",
    };
  }
  redirect(
    /^[0-9a-f-]{36}$/i.test(orderId) ? `/mypage/orders/${orderId}?cancelled=1` : "/mypage/orders",
  );
}
