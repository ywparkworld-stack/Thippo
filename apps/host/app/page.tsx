import Link from "next/link";
import { onboardingState } from "@thippo/payments";
import { Card, Notice, formatYen } from "@thippo/ui";
import { requireHost } from "./lib/host";
import { currentMonth, monthLabel, periodLabel } from "./lib/format";

/** ダッシュボード（SPEC §9）：これからの予約、今月の売上見込み */
export default async function Home(props: PageProps<"/">) {
  const { host, supabase } = await requireHost("/");
  const searchParams = await props.searchParams;
  const state = onboardingState(host);
  const now = new Date();
  const month = currentMonth(now);
  const [{ data: upcoming }, { data: summary }] = await Promise.all([
    supabase.rpc("host_bookings", {
      p_from: now.toISOString(),
      p_to: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
      p_status: "confirmed",
      p_limit: 20,
    }),
    supabase.rpc("host_statement_summary", { p_host_id: host.id, p_month: `${month}-01` }),
  ]);
  const s = summary?.[0];

  return (
    <div className="space-y-4">
      {searchParams.password === "updated" && (
        <Notice tone="success">パスワードを設定しました。</Notice>
      )}
      {state !== "complete" && (
        <Notice tone="warning">
          スペースを公開するには、会社情報と Stripe での入金先の登録が必要です。
          <Link href="/onboarding" className="ml-1 underline">
            登録へ進む
          </Link>
        </Notice>
      )}
      <h1 className="text-2xl font-bold">{host.company_name}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-500">{monthLabel(month)}の売上見込み（振込額）</p>
          <p className="text-2xl font-bold">{formatYen(s?.net ?? 0)}</p>
          <p className="text-xs text-zinc-500">決済日の月で集計。キャンセルがあれば変わります。</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">{monthLabel(month)}のお支払い合計</p>
          <p className="text-2xl font-bold">{formatYen(s?.gross ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">これから14日の予約</p>
          <p className="text-2xl font-bold">{upcoming?.length ?? 0}件</p>
        </Card>
      </div>
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">これからの予約</h2>
          <Link href="/bookings" className="text-sm text-brand-700 underline">
            すべての予約
          </Link>
        </div>
        <ul className="divide-y text-sm">
          {(upcoming ?? []).map((b) => (
            <li key={b.booking_id} className="flex justify-between py-2">
              <Link href={`/bookings/${b.booking_id}`} className="underline">
                {periodLabel(b.period_start, b.period_end)}　{b.space_name}
              </Link>
              <span>{b.guest_name} 様</span>
            </li>
          ))}
          {(upcoming ?? []).length === 0 && (
            <li className="py-2 text-zinc-500">これからの予約はありません。</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
