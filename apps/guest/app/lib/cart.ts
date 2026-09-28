import "server-only";
import {
  addDays,
  calcBookingFees,
  parseTstzRange,
  toTokyoDate,
  validateBookingPeriod,
  type BookingFees,
  type CartItemInput,
} from "@thippo/core";
import type { ServerSupabase } from "@thippo/auth/server";
import { loadAvailability } from "./availability";

import { CART_ITEM_ERROR_MESSAGES, type CartItemError } from "./cart-messages";

export { CART_ITEM_ERROR_MESSAGES, type CartItemError };

export interface EvaluatedCartItem {
  /** サーバーのカゴの行の id（ブラウザのカゴでは null） */
  id: string | null;
  item: CartItemInput;
  space: {
    id: string;
    name: string;
    area: string;
    hostId: string;
    companyName: string;
    minSlots: number;
    coverPath: string | null;
  } | null;
  fees: BookingFees | null;
  error: CartItemError | null;
}

/**
 * カゴの中身を今の状態で確かめ、金額をサーバー側の料金で計算する（SPEC §6・§7）。
 * 貸出主の id はブラウザから送られた値を信用せず、スペースから取り直す。
 */
export async function evaluateCartItems(
  supabase: ServerSupabase,
  entries: { id: string | null; item: CartItemInput }[],
  now = new Date(),
): Promise<EvaluatedCartItem[]> {
  if (entries.length === 0) return [];
  const spaceIds = [...new Set(entries.map((e) => e.item.spaceId))];
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name, area, host_id, price_per_30min, min_slots, status, deleted_at")
    .in("id", spaceIds)
    .eq("status", "published")
    .is("deleted_at", null);
  const { data: hosts } = await supabase
    .from("public_hosts")
    .select("id, company_name")
    .in("id", [...new Set((spaces ?? []).map((s) => s.host_id))]);
  const { data: photos } = await supabase
    .from("space_photos")
    .select("space_id, storage_path, sort_order")
    .in("space_id", spaceIds)
    .order("sort_order");

  const starts = entries.map((e) => Date.parse(e.item.start)).filter(Number.isFinite);
  const ends = entries.map((e) => Date.parse(e.item.end)).filter(Number.isFinite);
  const from = new Date(Math.min(now.getTime(), ...starts));
  const to = new Date(Math.max(now.getTime() + 60_000, ...ends));
  const clampedTo = new Date(Math.min(to.getTime(), from.getTime() + 61 * 86_400_000));
  const availability = await loadAvailability(
    supabase,
    (spaces ?? []).map((s) => s.id),
    from,
    clampedTo,
    toTokyoDate(from),
    addDays(toTokyoDate(clampedTo), 1),
  );

  return entries.map(({ id, item }) => {
    const s = spaces?.find((x) => x.id === item.spaceId);
    const companyName = hosts?.find((h) => h.id === s?.host_id)?.company_name;
    if (!s || !companyName)
      return { id, item, space: null, fees: null, error: "space_unavailable" as const };
    const space = {
      id: s.id,
      name: s.name,
      area: s.area,
      hostId: s.host_id,
      companyName,
      minSlots: s.min_slots,
      coverPath: photos?.find((p) => p.space_id === s.id)?.storage_path ?? null,
    };
    const start = new Date(item.start);
    const end = new Date(item.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { id, item, space, fees: null, error: "invalid_range" as const };
    }
    const a = availability.get(s.id)!;
    // 自分のカゴの同じ行は予約済みではないので、busy には含まれていない（カゴは枠を確保しない）
    const result = validateBookingPeriod({ start, end, minSlots: s.min_slots, ...a, now });
    if (!result.ok)
      return { id, item: { ...item, hostId: s.host_id }, space, fees: null, error: result.error };
    return {
      id,
      item: { ...item, hostId: s.host_id },
      space,
      fees: calcBookingFees({ pricePer30min: s.price_per_30min, slots: result.slots }),
      error: null,
    };
  });
}

/** ログイン中の利用者のカゴ（なければ null） */
export async function loadServerCart(supabase: ServerSupabase, userId: string) {
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("guest_id", userId)
    .maybeSingle();
  if (!cart) return { cartId: null, entries: [] as { id: string; item: CartItemInput }[] };
  const { data: rows } = await supabase
    .from("cart_items")
    .select("id, space_id, period, spaces(host_id)")
    .eq("cart_id", cart.id)
    .order("created_at");
  const entries = (rows ?? []).map((r) => {
    const { start, end } = parseTstzRange(r.period);
    const host = r.spaces as { host_id: string } | null;
    return { id: r.id, item: { spaceId: r.space_id, hostId: host?.host_id ?? "", start, end } };
  });
  return { cartId: cart.id, entries };
}

export async function ensureCart(supabase: ServerSupabase, userId: string): Promise<string> {
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("guest_id", userId)
    .maybeSingle();
  if (cart) return cart.id;
  const { data, error } = await supabase
    .from("carts")
    .insert({ guest_id: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`failed to create cart: ${error?.message}`);
  return data.id;
}
