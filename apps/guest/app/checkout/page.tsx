import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CANCEL_POLICY_LINES,
  formatTokyoDateTime,
  minutesToTime,
  sumYen,
  toTokyoMinutes,
} from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice, formatYen } from "@thippo/ui";
import { evaluateCartItems, loadServerCart } from "../lib/cart";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "購入手続き｜thippo" };

/** 購入手続き（SPEC §6）。ログインと本人確認の承認が必要 */
export default async function CheckoutPage() {
  const { supabase, userId } = await requireAppSession("guest", "/checkout");
  const { data: profile } = await supabase
    .from("profiles")
    .select("identity_status")
    .eq("id", userId)
    .single();

  if (profile?.identity_status !== "approved") {
    return (
      <Card className="mx-auto max-w-xl space-y-3">
        <h1 className="text-xl font-bold">購入手続き</h1>
        <Notice tone="warning">
          ご予約には本人確認が必要です。
          {profile?.identity_status === "pending"
            ? "提出いただいた書類を確認しています。確認が済むまでお待ちください。"
            : ""}
        </Notice>
        <Link href="/mypage/identity" className="text-brand-700 underline">
          本人確認へ
        </Link>
      </Card>
    );
  }

  const items = await evaluateCartItems(supabase, (await loadServerCart(supabase, userId)).entries);
  if (items.length === 0 || items.some((i) => i.error)) redirect("/cart");
  const total = sumYen(items.map((i) => i.fees!.subtotal));
  const time = (iso: string) => minutesToTime(toTokyoMinutes(new Date(iso)));

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">購入手続き</h1>
        <Card className="divide-y p-0">
          {items.map((e) => (
            <div key={e.id} className="flex justify-between p-4 text-sm">
              <div>
                <p className="font-bold">{e.space!.name}</p>
                <p className="text-xs text-zinc-500">{e.space!.companyName}</p>
                <p>
                  {formatTokyoDateTime(new Date(e.item.start))}〜{time(e.item.end)}（
                  {e.fees!.slots * 30}分）
                </p>
              </div>
              <p className="font-bold">{formatYen(e.fees!.subtotal)}</p>
            </div>
          ))}
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">キャンセル規定</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {CANCEL_POLICY_LINES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="space-y-4 self-start">
        <p className="flex justify-between">
          <span>お支払い金額（税込）</span>
          <span className="text-xl font-bold">{formatYen(total)}</span>
        </p>
        <CheckoutForm
          total={total}
          publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
        />
        <Link href="/cart" className="block text-center text-sm text-brand-700 underline">
          予約カゴに戻る
        </Link>
      </Card>
    </div>
  );
}
