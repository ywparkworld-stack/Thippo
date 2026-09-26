import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { ORDER_STATUS_LABELS, dt } from "../lib/format";

/** 注文の一覧・検索（注文番号・利用者のメールアドレス） */
export default async function OrdersPage(props: PageProps<"/orders">) {
  const { supabase } = await requireAppSession("admin", "/orders");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  let guestIds: string[] | null = null;
  if (q && q.includes("@")) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", `%${q.replace(/[%_\\]/g, "\\$&")}%`)
      .limit(50);
    guestIds = (data ?? []).map((p) => p.id);
  }
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, total, application_fee_amount, created_at, paid_at, profiles!orders_guest_id_fkey(email), hosts(company_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (guestIds)
    query = query.in(
      "guest_id",
      guestIds.length ? guestIds : ["00000000-0000-0000-0000-000000000000"],
    );
  else if (q) query = query.ilike("order_number", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data: orders } = await query;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">予約・決済</h1>
      <form className="flex gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="注文番号・利用者のメールアドレス"
          className="w-80 rounded-md border border-zinc-300 px-3 py-1.5"
        />
        <button className="rounded-md border px-3 py-1.5">検索</button>
      </form>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">注文番号</th>
              <th className="px-4 py-2">利用者</th>
              <th className="px-4 py-2">貸出主</th>
              <th className="px-4 py-2 text-right">金額</th>
              <th className="px-4 py-2 text-right">application fee</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">注文日時</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/orders/${o.id}`} className="font-mono text-brand-700 underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{(o.profiles as { email: string } | null)?.email}</td>
                <td className="px-4 py-2">
                  {(o.hosts as { company_name: string } | null)?.company_name}
                </td>
                <td className="px-4 py-2 text-right">{formatYen(o.total)}</td>
                <td className="px-4 py-2 text-right">{formatYen(o.application_fee_amount)}</td>
                <td className="px-4 py-2">{ORDER_STATUS_LABELS[o.status]}</td>
                <td className="px-4 py-2">{dt(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
