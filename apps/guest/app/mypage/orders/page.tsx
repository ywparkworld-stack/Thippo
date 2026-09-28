import Link from "next/link";
import { formatTokyoDateTime } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { ORDER_STATUS_LABELS } from "../../lib/orders";

export const metadata = { title: "予約履歴｜thippo" };

/** 予約履歴（注文単位。SPEC §6） */
export default async function OrdersPage() {
  const { supabase, userId } = await requireAppSession("guest", "/mypage/orders");
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, hosts(company_name), bookings(count)")
    .eq("guest_id", userId)
    .in("status", ["paid", "pending"])
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">予約履歴</h1>
      <Card className="divide-y p-0">
        {(orders ?? []).map((o) => (
          <Link
            key={o.id}
            href={`/mypage/orders/${o.id}`}
            className="flex justify-between p-4 text-sm hover:bg-zinc-50"
          >
            <span>
              <span className="font-mono font-bold">{o.order_number}</span>
              <span className="ml-2 text-zinc-500">
                {formatTokyoDateTime(new Date(o.created_at))}
              </span>
              <br />
              {(o.hosts as { company_name: string } | null)?.company_name}・
              {(o.bookings as unknown as { count: number }[])[0]?.count ?? 0}件
            </span>
            <span className="text-right">
              {formatYen(o.total)}
              <br />
              <span className="text-xs text-zinc-500">{ORDER_STATUS_LABELS[o.status]}</span>
            </span>
          </Link>
        ))}
        {(orders ?? []).length === 0 && (
          <p className="p-8 text-center text-sm text-zinc-500">予約はまだありません。</p>
        )}
      </Card>
      <Link href="/mypage" className="text-sm text-brand-700 underline">
        マイページに戻る
      </Link>
    </div>
  );
}
