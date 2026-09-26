import "server-only";
import { formatTokyoDateTime, minutesToTime, parseTstzRange, toTokyoMinutes } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import type { BookingLine } from "@thippo/mail";
import { sendTemplatedEmail } from "@thippo/mail/send";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

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
  const lines: BookingLine[] = (bookings ?? []).map((b) => {
    const { start, end } = parseTstzRange(b.period);
    const space = b.spaces as { name: string; address: string } | null;
    return {
      spaceName: space?.name ?? "",
      address: space?.address ?? "",
      when: `${formatTokyoDateTime(new Date(start))}〜${minutesToTime(toTokyoMinutes(new Date(end)))}`,
      amount: yen(b.total),
    };
  });
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
