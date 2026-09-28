"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DIFFERENT_HOST_MESSAGE,
  planCartMerge,
  toTstzRange,
  type CartItemInput,
} from "@thippo/core";
import { createClient, loadSession } from "@thippo/auth/server";
import {
  CART_ITEM_ERROR_MESSAGES,
  ensureCart,
  evaluateCartItems,
  loadServerCart,
  type EvaluatedCartItem,
} from "../lib/cart";

const itemSchema = z.object({
  spaceId: z.uuid(),
  hostId: z.string().max(64).default(""),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
});
const itemsSchema = z.array(itemSchema).max(10);

export type AddToCartResult =
  | { ok: true; mode: "server" }
  /** 未ログイン：ブラウザのカゴに保存する（貸出主の id はサーバーで確かめた値） */
  | { ok: true; mode: "local"; item: CartItemInput }
  | { ok: false; error: "different_host"; message: string }
  | { ok: false; error: "invalid"; message: string };

async function guestSession() {
  const supabase = await createClient();
  const session = await loadSession(supabase);
  const isGuest =
    !!session && session.role === "guest" && session.status === "active" && !session.deleted;
  return { supabase, session: isGuest ? session : null };
}

/**
 * 予約カゴに入れる。カゴに入れただけでは枠は確保しない（SPEC §6）。
 * 別の貸出主のスペースが入っていれば different_host を返し、replace=true なら入れ替える。
 */
export async function addToCartAction(input: unknown, replace = false): Promise<AddToCartResult> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "invalid", message: "予約の内容が正しくありません。" };
  const { supabase, session } = await guestSession();

  const [evaluated] = await evaluateCartItems(supabase, [{ id: null, item: parsed.data }]);
  if (!evaluated || evaluated.error) {
    return {
      ok: false,
      error: "invalid",
      message: CART_ITEM_ERROR_MESSAGES[evaluated?.error ?? "space_unavailable"],
    };
  }
  if (!session) return { ok: true, mode: "local", item: evaluated.item };

  const cart = await loadServerCart(supabase, session.userId);
  const cartHost = cart.entries[0]?.item.hostId ?? null;
  if (cartHost && cartHost !== evaluated.item.hostId) {
    if (!replace) return { ok: false, error: "different_host", message: DIFFERENT_HOST_MESSAGE };
    await supabase.from("cart_items").delete().eq("cart_id", cart.cartId!);
  }
  const cartId = await ensureCart(supabase, session.userId);
  const { error } = await supabase.from("cart_items").insert({
    cart_id: cartId,
    space_id: evaluated.item.spaceId,
    period: toTstzRange(evaluated.item.start, evaluated.item.end),
  });
  if (error) {
    const message = error.message.includes("cart_items_no_overlap")
      ? "同じ時間帯がすでに予約カゴに入っています。"
      : error.message.includes("cart_full")
        ? "予約カゴに入れられるのは10件までです。"
        : error.message.includes("予約カゴを分けて")
          ? DIFFERENT_HOST_MESSAGE
          : "予約カゴに入れられませんでした。";
    return { ok: false, error: "invalid", message };
  }
  revalidatePath("/cart");
  return { ok: true, mode: "server" };
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("itemId"));
  if (!id.success) return;
  const { supabase, session } = await guestSession();
  if (!session) return;
  // RLS で自分のカゴの行だけが消える
  await supabase.from("cart_items").delete().eq("id", id.data);
  revalidatePath("/cart");
}

/** 未ログインのカゴ（ブラウザに保存）の中身を、今の状態で確かめて金額を付ける */
export async function describeLocalCartAction(items: unknown): Promise<EvaluatedCartItem[]> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return [];
  const supabase = await createClient();
  return evaluateCartItems(
    supabase,
    parsed.data.map((item) => ({ id: null, item })),
  );
}

/**
 * ログインしたときに、ブラウザのカゴをサーバーのカゴへ移す（付録 D18）。
 * サーバーのカゴを優先し、貸出主が違えばブラウザのカゴは捨てる。予約できない行は移さない。
 */
export async function mergeLocalCartAction(
  items: unknown,
): Promise<{ merged: number; discarded: boolean }> {
  const parsed = itemsSchema.safeParse(items);
  const { supabase, session } = await guestSession();
  if (!parsed.success || !session) return { merged: 0, discarded: false };

  // ブラウザの貸出主の id は信用せず、サーバーで確かめた値を使う
  const evaluated = (
    await evaluateCartItems(
      supabase,
      parsed.data.map((item) => ({ id: null, item })),
    )
  ).filter((e) => !e.error);
  const cart = await loadServerCart(supabase, session.userId);
  const plan = planCartMerge(
    { hostId: cart.entries[0]?.item.hostId ?? null, items: cart.entries.map((e) => e.item) },
    evaluated.map((e) => e.item),
  );
  if (plan.action === "discard_local") return { merged: 0, discarded: true };
  if (plan.action === "keep_server") return { merged: 0, discarded: false };

  const cartId = await ensureCart(supabase, session.userId);
  let merged = 0;
  for (const item of plan.items) {
    const { error } = await supabase.from("cart_items").insert({
      cart_id: cartId,
      space_id: item.spaceId,
      period: toTstzRange(item.start, item.end),
    });
    if (!error) merged++;
  }
  revalidatePath("/cart");
  return { merged, discarded: false };
}
