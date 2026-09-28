import Link from "next/link";
import { Card, formatYen } from "@thippo/ui";
import { requireHost } from "../lib/host";
import { monthLabel, previousMonths } from "../lib/format";

/** 売上・振込（月別の明細。決済日の月で集計。付録 D24） */
export default async function SalesPage() {
  const { supabase, host } = await requireHost("/sales");
  const months = previousMonths(12);
  const [summaries, { data: statements }] = await Promise.all([
    Promise.all(
      months.map(async (month) => {
        const { data } = await supabase.rpc("host_statement_summary", {
          p_host_id: host.id,
          p_month: `${month}-01`,
        });
        return { month, s: data?.[0] };
      }),
    ),
    supabase
      .from("monthly_statements")
      .select("month, issued_at")
      .eq("host_id", host.id)
      .not("issued_at", "is", null),
  ]);
  const issued = new Set((statements ?? []).map((s) => s.month.slice(0, 7)));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">売上・振込</h1>
      <p className="text-sm text-zinc-600">
        決済日の月で集計しています。キャンセルによる返金は、キャンセルした日の月に差し引きます。振込は毎月23日です。
      </p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">月</th>
              <th className="px-4 py-2 text-right">お支払い合計</th>
              <th className="px-4 py-2 text-right">運営手数料（税抜）</th>
              <th className="px-4 py-2 text-right">消費税</th>
              <th className="px-4 py-2 text-right">決済手数料</th>
              <th className="px-4 py-2 text-right">振込額</th>
              <th className="px-4 py-2">請求書</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ month, s }) => (
              <tr key={month} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/sales/${month}`} className="text-brand-700 underline">
                    {monthLabel(month)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right">{formatYen(s?.gross ?? 0)}</td>
                <td className="px-4 py-2 text-right">{formatYen(s?.platform_fee_excl_tax ?? 0)}</td>
                <td className="px-4 py-2 text-right">{formatYen(s?.platform_fee_tax ?? 0)}</td>
                <td className="px-4 py-2 text-right">{formatYen(s?.stripe_fee ?? 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatYen(s?.net ?? 0)}</td>
                <td className="px-4 py-2">
                  {issued.has(month) ? (
                    <a href={`/sales/${month}/pdf`} className="text-brand-700 underline">
                      PDF
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400">未発行</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
