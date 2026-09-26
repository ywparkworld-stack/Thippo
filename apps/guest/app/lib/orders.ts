import "server-only";
import type { ServerSupabase } from "@thippo/auth/server";
import { parseTstzRange } from "@thippo/core";

export const ORDER_STATUS_LABELS = {
  pending: "お支払い待ち",
  paid: "お支払い済み",
  expired: "期限切れ",
  failed: "お支払い失敗",
} as const;

export const BOOKING_STATUS_LABELS = {
  pending: "お支払い待ち",
  expired: "期限切れ",
  confirmed: "予約確定",
  cancelled: "キャンセル済み",
  completed: "利用済み",
  no_show: "無断キャンセル",
} as const;

/** 自分の注文（RLS で本人の注文だけが読める） */
export async function loadOwnOrder(supabase: ServerSupabase, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total, created_at, paid_at, stripe_payment_intent_id, late_payment_refunded_at, hosts(company_name)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, period, slots, total, status, spaces(id, name, address)")
    .eq("order_id", orderId)
    .order("period");
  return {
    ...order,
    companyName: (order.hosts as { company_name: string } | null)?.company_name ?? "",
    bookings: (bookings ?? []).map((b) => ({
      ...b,
      ...parseTstzRange(b.period),
      space: b.spaces as { id: string; name: string; address: string } | null,
    })),
  };
}
