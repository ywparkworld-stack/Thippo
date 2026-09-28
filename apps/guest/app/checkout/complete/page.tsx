import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTokyoDateTime, minutesToTime, toTokyoMinutes } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { isStubId } from "@thippo/payments";
import { stripe } from "@thippo/payments/server";
import { Card, Notice, formatYen } from "@thippo/ui";
import { loadOwnOrder } from "../../lib/orders";
import { handleSucceededPaymentIntent } from "../../lib/payments";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "ご注文ありがとうございました｜thippo" };

/**
 * 注文完了（SPEC §6）。Stripe から戻ってきたとき、Webhook より先に着いた場合は
 * ここでも PaymentIntent の状態を確かめて確定させる（処理は Webhook と同じで、二重にはならない）。
 */
export default async function CompletePage(props: PageProps<"/checkout/complete">) {
  const { supabase } = await requireAppSession("guest", "/mypage/orders");
  const sp = await props.searchParams;
  const orderId = typeof sp.order === "string" ? sp.order : "";
  let order = await loadOwnOrder(supabase, orderId);
  if (!order) notFound();

  // テスト用の支払い（付録 D37）は支払い画面で確定するため、ここで Stripe に問い合わせない
  const stubPending = order.status === "pending" && isStubId(order.stripe_payment_intent_id);
  if (order.status === "pending" && order.stripe_payment_intent_id && !stubPending) {
    const pi = await stripe().paymentIntents.retrieve(order.stripe_payment_intent_id);
    if (pi.status === "succeeded") {
      await handleSucceededPaymentIntent(pi);
      order = (await loadOwnOrder(supabase, orderId))!;
    }
  }
  const time = (iso: string) => minutesToTime(toTokyoMinutes(new Date(iso)));

  return (
    <Card className="mx-auto max-w-2xl space-y-4">
      {order.status === "paid" ? (
        <>
          <h1 className="text-2xl font-bold">ご予約が確定しました</h1>
          <p className="text-sm text-zinc-700">確認のメールをお送りしました。</p>
        </>
      ) : stubPending ? (
        <>
          <h1 className="text-2xl font-bold">お支払いが完了していません</h1>
          <Notice tone="warning">予約カゴからもう一度お手続きください。</Notice>
          <Link href="/cart" className="text-brand-700 underline">
            予約カゴに戻る
          </Link>
        </>
      ) : order.status === "pending" ? (
        <>
          <h1 className="text-2xl font-bold">お支払いを確認しています</h1>
          <Notice tone="info">しばらくお待ちください。この画面は自動で更新されます。</Notice>
          <AutoRefresh />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">ご予約を確定できませんでした</h1>
          <Notice tone="error">
            お支払いの期限を過ぎたか、お支払いに失敗しました。
            {order.late_payment_refunded_at && "お支払いいただいた金額は全額返金します。"}
          </Notice>
          <Link href="/cart" className="text-brand-700 underline">
            予約カゴに戻る
          </Link>
        </>
      )}
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
        <dt className="text-zinc-500">注文番号</dt>
        <dd className="font-mono font-bold">{order.order_number}</dd>
        <dt className="text-zinc-500">お支払い金額</dt>
        <dd>{formatYen(order.total)}（税込）</dd>
        <dt className="text-zinc-500">貸出主</dt>
        <dd>{order.companyName}</dd>
      </dl>
      <ul className="divide-y rounded border text-sm">
        {order.bookings.map((b) => (
          <li key={b.id} className="flex justify-between p-3">
            <span>
              <span className="font-bold">{b.space?.name}</span>
              <br />
              {formatTokyoDateTime(new Date(b.start))}〜{time(b.end)}
              <br />
              <span className="text-xs text-zinc-500">{b.space?.address}</span>
            </span>
            <span>{formatYen(b.total)}</span>
          </li>
        ))}
      </ul>
      <Link href={`/mypage/orders/${order.id}`} className="text-brand-700 underline">
        予約履歴で確認する
      </Link>
    </Card>
  );
}
