import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTokyoDateTime, minutesToTime, toTokyoMinutes } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice, formatYen } from "@thippo/ui";
import { BOOKING_STATUS_LABELS, ORDER_STATUS_LABELS, loadOwnOrder } from "../../../lib/orders";

export default async function OrderPage(props: PageProps<"/mypage/orders/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase } = await requireAppSession("guest", `/mypage/orders/${id}`);
  const order = await loadOwnOrder(supabase, id);
  if (!order) notFound();
  const time = (iso: string) => minutesToTime(toTokyoMinutes(new Date(iso)));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {sp.cancelled === "1" && (
        <Notice tone="success">キャンセルしました。確認のメールをお送りしました。</Notice>
      )}
      <Link href="/mypage/orders" className="text-sm text-brand-700 underline">
        予約履歴
      </Link>
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">注文番号 {order.order_number}</h1>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">状態</dt>
          <dd>{ORDER_STATUS_LABELS[order.status]}</dd>
          <dt className="text-zinc-500">ご注文日時</dt>
          <dd>{formatTokyoDateTime(new Date(order.created_at))}</dd>
          <dt className="text-zinc-500">お支払い金額</dt>
          <dd>{formatYen(order.total)}（税込）</dd>
          <dt className="text-zinc-500">貸出主</dt>
          <dd>{order.companyName}</dd>
        </dl>
        {order.status === "paid" && (
          <Link
            href={`/mypage/orders/${order.id}/receipt`}
            className="text-sm text-brand-700 underline"
          >
            領収書を表示する
          </Link>
        )}
      </Card>
      <Card className="divide-y p-0">
        {order.bookings.map((b) => (
          <div key={b.id} className="flex justify-between p-4 text-sm">
            <span>
              <span className="font-bold">{b.space?.name}</span>
              <br />
              {formatTokyoDateTime(new Date(b.start))}〜{time(b.end)}（{b.slots * 30}分）
              <br />
              <span className="text-xs text-zinc-500">{b.space?.address}</span>
            </span>
            <span className="text-right">
              {formatYen(b.total)}
              <br />
              <span className="text-xs text-zinc-500">{BOOKING_STATUS_LABELS[b.status]}</span>
              {b.refund && b.refund.refund_amount > 0 && (
                <>
                  <br />
                  <span className="text-xs">
                    返金 {formatYen(b.refund.refund_amount)}（
                    {b.refund.status === "succeeded" ? "完了" : "手続き中"}）
                  </span>
                </>
              )}
              {b.status === "confirmed" && new Date(b.end) > new Date() && (
                <>
                  <br />
                  <Link
                    href={`/mypage/bookings/${b.id}/cancel`}
                    className="text-xs text-red-600 underline"
                  >
                    キャンセルする
                  </Link>
                </>
              )}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
