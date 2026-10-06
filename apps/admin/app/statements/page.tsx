import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { issueStatementAction } from "../actions/admin";
import { ActionForm } from "../_components/action-form";
import { dt, monthLabel, parseMonth, shiftMonth } from "../lib/format";

/** 月次集計（貸出主ごと）・月次明細と請求書の発行・決済手数料の見込み額と実額の差額（SPEC §10） */
export default async function StatementsPage(props: PageProps<"/statements">) {
  const { supabase } = await requireAppSession("admin", "/statements");
  const sp = await props.searchParams;
  const month = parseMonth(sp.month);
  const { data: rows } = await supabase.rpc("admin_host_month_summaries", {
    p_month: `${month}-01`,
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">月次集計</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`/statements?month=${shiftMonth(month, -1)}`}>← 前の月</Link>
          <span className="font-bold">{monthLabel(month)}</span>
          <Link href={`/statements?month=${shiftMonth(month, 1)}`}>次の月 →</Link>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        決済日の月で集計し、キャンセルはキャンセルした日の月に調整しています。月が終わってから発行してください（「定期処理」の画面から、まとめて発行することもできます）。
      </p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2">貸出主</th>
              <th className="px-3 py-2 text-right">お支払い</th>
              <th className="px-3 py-2 text-right">運営手数料（税抜）</th>
              <th className="px-3 py-2 text-right">消費税</th>
              <th className="px-3 py-2 text-right">決済手数料（見込み）</th>
              <th className="px-3 py-2 text-right">差額（実額−見込み）</th>
              <th className="px-3 py-2 text-right">振込額</th>
              <th className="px-3 py-2">明細・請求書</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.host_id} className="border-b align-top last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/hosts/${r.host_id}`} className="underline">
                    {r.company_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right">{formatYen(r.gross)}</td>
                <td className="px-3 py-2 text-right">{formatYen(r.platform_fee_excl_tax)}</td>
                <td className="px-3 py-2 text-right">{formatYen(r.platform_fee_tax)}</td>
                <td className="px-3 py-2 text-right">{formatYen(r.stripe_fee)}</td>
                <td className="px-3 py-2 text-right">{formatYen(r.stripe_fee_difference)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatYen(r.net)}</td>
                <td className="px-3 py-2">
                  {r.statement_issued_at ? (
                    <a
                      href={`/statements/${r.host_id}/${month}`}
                      className="text-brand-700 underline"
                    >
                      PDF（{dt(r.statement_issued_at).slice(0, 13)}発行）
                    </a>
                  ) : (
                    <ActionForm
                      action={issueStatementAction}
                      hidden={{ hostId: r.host_id, month }}
                      label="発行する"
                      withReason={false}
                      variant="secondary"
                      confirmText={`${r.company_name} の${monthLabel(month)}分を発行します。発行後は作り直せません。`}
                    />
                  )}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
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
