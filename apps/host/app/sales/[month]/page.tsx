import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTokyoDateTime } from "@thippo/core";
import { Card, formatYen } from "@thippo/ui";
import { requireHost } from "../../lib/host";
import { monthLabel } from "../../lib/format";

/** 月別の明細と予約ごとの内訳（SPEC §9） */
export default async function SalesMonthPage(props: PageProps<"/sales/[month]">) {
  const { month } = await props.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  const { supabase, host } = await requireHost(`/sales/${month}`);
  const [{ data: summary }, { data: lines }, { data: statement }] = await Promise.all([
    supabase.rpc("host_statement_summary", { p_host_id: host.id, p_month: `${month}-01` }),
    supabase.rpc("host_statement_lines", { p_host_id: host.id, p_month: `${month}-01` }),
    supabase
      .from("monthly_statements")
      .select("issued_at")
      .eq("host_id", host.id)
      .eq("month", `${month}-01`)
      .maybeSingle(),
  ]);
  const s = summary?.[0];
  return (
    <div className="space-y-4">
      <Link href="/sales" className="text-sm text-brand-700 underline">
        売上・振込
      </Link>
      <h1 className="text-2xl font-bold">{monthLabel(month)}の明細</h1>
      <Card>
        <dl className="grid grid-cols-[14rem_1fr] gap-y-1 text-sm">
          <dt>利用者のお支払い合計</dt>
          <dd className="text-right">{formatYen(s?.gross ?? 0)}</dd>
          <dt>運営手数料（税抜）</dt>
          <dd className="text-right">-{formatYen(s?.platform_fee_excl_tax ?? 0)}</dd>
          <dt>運営手数料の消費税</dt>
          <dd className="text-right">-{formatYen(s?.platform_fee_tax ?? 0)}</dd>
          <dt>決済手数料</dt>
          <dd className="text-right">-{formatYen(s?.stripe_fee ?? 0)}</dd>
          <dt className="font-bold">振込額</dt>
          <dd className="text-right font-bold">{formatYen(s?.net ?? 0)}</dd>
        </dl>
        {statement?.issued_at && (
          <a
            href={`/sales/${month}/pdf`}
            className="mt-3 inline-block text-sm text-brand-700 underline"
          >
            月次明細・請求書（PDF）をダウンロード
          </a>
        )}
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2">日時</th>
              <th className="px-3 py-2">区分</th>
              <th className="px-3 py-2">注文番号</th>
              <th className="px-3 py-2">スペース</th>
              <th className="px-3 py-2 text-right">お支払い</th>
              <th className="px-3 py-2 text-right">運営手数料</th>
              <th className="px-3 py-2 text-right">決済手数料</th>
              <th className="px-3 py-2 text-right">振込額</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={`${l.kind}-${l.booking_id}`} className="border-b last:border-0">
                <td className="px-3 py-2">{formatTokyoDateTime(new Date(l.occurred_at))}</td>
                <td className="px-3 py-2">{l.kind === "payment" ? "決済" : "キャンセル"}</td>
                <td className="px-3 py-2">
                  <Link href={`/bookings/${l.booking_id}`} className="font-mono underline">
                    {l.order_number}
                  </Link>
                </td>
                <td className="px-3 py-2">{l.space_name}</td>
                <td className="px-3 py-2 text-right">{formatYen(l.gross)}</td>
                <td className="px-3 py-2 text-right">
                  {formatYen(l.platform_fee_excl_tax + l.platform_fee_tax)}
                </td>
                <td className="px-3 py-2 text-right">{formatYen(l.stripe_fee)}</td>
                <td className="px-3 py-2 text-right">{formatYen(l.net)}</td>
              </tr>
            ))}
            {(lines ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  この月の取引はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
