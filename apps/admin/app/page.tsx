import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { Card, Notice, formatYen } from "@thippo/ui";
import { monthLabel, parseMonth, shiftMonth } from "./lib/format";

/** ダッシュボード（SPEC §10・付録 D24・D27） */
export default async function Home(props: PageProps<"/">) {
  const { supabase } = await requireAppSession("admin", "/");
  const sp = await props.searchParams;
  const month = parseMonth(sp.month);
  const [{ data: summary }, identity, applications, refunds, mail] = await Promise.all([
    supabase.rpc("admin_month_summary", { p_month: `${month}-01` }),
    supabase
      .from("identity_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("host_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("refunds").select("id", { count: "exact", head: true }).eq("status", "failed"),
    // 送信待ちのメール（手作業で送る。付録 D39）
    createSupabaseServiceClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
  ]);
  const s = summary?.[0];
  const tiles: [string, string, string?][] = [
    ["予約件数（決済）", `${s?.booking_count ?? 0}件`],
    ["利用総額（返金を差し引いた額）", formatYen(s?.gross ?? 0)],
    ["運営手数料（税抜）", formatYen(s?.platform_fee_excl_tax ?? 0)],
    ["預かり消費税", formatYen(s?.platform_fee_tax ?? 0)],
    ["全額返金による決済手数料の負担", formatYen(s?.full_refund_stripe_fee ?? 0)],
    [
      "決済手数料の差額（実額 − 見込み額）",
      formatYen(s?.stripe_fee_difference ?? 0),
      "実額が取れた注文だけ",
    ],
    ["実質収入", formatYen(s?.net_income ?? 0), "運営手数料（税抜）− 全額返金の負担 − 差額"],
  ];
  const todo: [string, number, string][] = [
    ["本人確認の審査待ち", identity.count ?? 0, "/identity"],
    ["掲載申込の審査待ち", applications.count ?? 0, "/host-applications"],
    ["失敗した返金", refunds.count ?? 0, "/refunds"],
    ["送信待ちのメール", mail.count ?? 0, "/mail"],
  ];
  return (
    <div className="space-y-6">
      {sp.password === "updated" && <Notice tone="success">パスワードを変更しました。</Notice>}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`/?month=${shiftMonth(month, -1)}`}>← 前の月</Link>
          <span className="font-bold">{monthLabel(month)}</span>
          <Link href={`/?month=${shiftMonth(month, 1)}`}>次の月 →</Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {todo.map(([label, n, href]) => (
          <Link key={label} href={href}>
            <Card className={n > 0 ? "border-amber-300" : ""}>
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="text-2xl font-bold">{n}件</p>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {tiles.map(([label, value, note]) => (
          <Card key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {note && <p className="text-xs text-zinc-400">{note}</p>}
          </Card>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        決済日の月で集計し、キャンセルはキャンセルした日の月に調整しています。
      </p>
    </div>
  );
}
