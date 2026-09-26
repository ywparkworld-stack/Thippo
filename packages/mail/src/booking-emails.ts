import "server-only";
import { formatTokyoDateTime, minutesToTime, parseTstzRange, toTokyoMinutes } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { sendTemplatedEmail } from "./send";
import type { BookingLine } from "./templates";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

function bookingLine(b: { period: string; total: number; spaces: unknown }): BookingLine {
  const { start, end } = parseTstzRange(b.period);
  const space = b.spaces as { name: string; address: string } | null;
  return {
    spaceName: space?.name ?? "",
    address: space?.address ?? "",
    when: `${formatTokyoDateTime(new Date(start))}〜${minutesToTime(toTokyoMinutes(new Date(end)))}`,
    amount: yen(b.total),
  };
}

async function loadOrder(orderId: string) {
  const service = createSupabaseServiceClient();
  const { data: order } = await service
    .from("orders")
    .select(
      "id, order_number, total, guest_id, host_id, profiles!orders_guest_id_fkey(email, display_name), hosts(company_name)",
    )
    .eq("id", orderId)
    .single();
  if (!order) throw new Error(`order ${orderId} not found`);
  const { data: bookings } = await service
    .from("bookings")
    .select("period, total, spaces(name, address)")
    .eq("order_id", orderId)
    .order("period");
  const lines: BookingLine[] = (bookings ?? []).map(bookingLine);
  const { data: members } = await service
    .from("host_members")
    .select("profiles(email)")
    .eq("host_id", order.host_id);
  return {
    order,
    lines,
    guest: order.profiles as { email: string; display_name: string | null } | null,
    companyName: (order.hosts as { company_name: string } | null)?.company_name ?? "",
    hostEmails: (members ?? [])
      .map((m) => (m.profiles as { email: string } | null)?.email)
      .filter((e): e is string => !!e),
  };
}

/** 予約確定のメールを利用者と貸出主に送る（SPEC §7-3・§12）。同じ注文で二重には送らない */
export async function sendOrderConfirmedEmails(orderId: string): Promise<void> {
  const { order, lines, guest, companyName, hostEmails } = await loadOrder(orderId);
  const guestName = guest?.display_name ?? "お客";
  if (guest) {
    await sendTemplatedEmail({
      template: "bookingConfirmedGuest",
      to: guest.email,
      userId: order.guest_id,
      data: { name: guestName, orderNumber: order.order_number, lines, total: yen(order.total) },
      idempotencyKey: `order.confirmed.guest:${order.id}`,
    });
  }
  for (const email of hostEmails) {
    await sendTemplatedEmail({
      template: "bookingConfirmedHost",
      to: email,
      userId: null,
      data: { companyName, orderNumber: order.order_number, guestName, lines },
      idempotencyKey: `order.confirmed.host:${order.id}:${email}`,
    });
  }
}

export async function sendLatePaymentRefundedEmail(orderId: string): Promise<void> {
  const { order, guest } = await loadOrder(orderId);
  if (!guest) return;
  await sendTemplatedEmail({
    template: "latePaymentRefunded",
    to: guest.email,
    userId: order.guest_id,
    data: {
      name: guest.display_name ?? "お客",
      orderNumber: order.order_number,
      total: yen(order.total),
    },
    idempotencyKey: `order.late_refund:${order.id}`,
  });
}

async function loadBooking(bookingId: string) {
  const service = createSupabaseServiceClient();
  const { data: b } = await service
    .from("bookings")
    .select("id, order_id, period, total, cancelled_by, cancel_reason, spaces(name, address)")
    .eq("id", bookingId)
    .single();
  if (!b) throw new Error(`booking ${bookingId} not found`);
  return { booking: b, line: bookingLine(b), ...(await loadOrder(b.order_id)) };
}

const CANCELLED_BY_LABEL = {
  guest: "利用者によるキャンセル",
  host: "貸出主都合のキャンセル",
  admin: "運営によるキャンセル",
} as const;

/** キャンセルのメールを利用者と貸出主に送る（SPEC §12） */
export async function sendBookingCancelledEmails(
  bookingId: string,
  refundAmount: number,
): Promise<void> {
  const { booking, line, order, guest, companyName, hostEmails } = await loadBooking(bookingId);
  const by = (booking.cancelled_by ?? "guest") as keyof typeof CANCELLED_BY_LABEL;
  if (guest) {
    await sendTemplatedEmail({
      template: "bookingCancelledGuest",
      to: guest.email,
      userId: order.guest_id,
      data: {
        name: guest.display_name ?? "お客",
        orderNumber: order.order_number,
        line,
        byHost: by !== "guest",
        reason: by === "guest" ? null : booking.cancel_reason,
        refund: yen(refundAmount),
      },
      idempotencyKey: `booking.cancelled.guest:${booking.id}`,
    });
  }
  for (const email of hostEmails) {
    await sendTemplatedEmail({
      template: "bookingCancelledHost",
      to: email,
      userId: null,
      data: {
        companyName,
        orderNumber: order.order_number,
        line,
        cancelledBy: CANCELLED_BY_LABEL[by],
        reason: by === "guest" ? null : booking.cancel_reason,
      },
      idempotencyKey: `booking.cancelled.host:${booking.id}:${email}`,
    });
  }
}

/** 返金完了のメール（SPEC §12） */
export async function sendRefundCompletedEmail(refundId: string): Promise<void> {
  const service = createSupabaseServiceClient();
  const { data: refund } = await service
    .from("refunds")
    .select("id, booking_id, refund_amount")
    .eq("id", refundId)
    .single();
  if (!refund || refund.refund_amount === 0) return;
  const { order, guest, line } = await loadBooking(refund.booking_id);
  if (!guest) return;
  await sendTemplatedEmail({
    template: "refundCompleted",
    to: guest.email,
    userId: order.guest_id,
    data: {
      name: guest.display_name ?? "お客",
      orderNumber: order.order_number,
      spaceName: line.spaceName,
      amount: yen(refund.refund_amount),
    },
    idempotencyKey: `refund.completed:${refund.id}`,
  });
}
