import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addDays,
  computeDaySlots,
  formatTokyoDateTime,
  minutesToTime,
  timeToMinutes,
  toTokyoDate,
  tokyoToUtc,
  type AvailabilityRule,
} from "@thippo/core";
import { Card } from "@thippo/ui";
import { deleteClosureAction } from "../../../actions/spaces";
import { requireHost } from "../../../lib/host";
import { SpaceTabs } from "../../_components/space-tabs";
import { ClosureForm, RulesForm } from "./forms";

const PREVIEW_DAYS = 14;

export default async function AvailabilityPage(props: PageProps<"/spaces/[id]/availability">) {
  const { id } = await props.params;
  const { supabase, host } = await requireHost(`/spaces/${id}/availability`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: space } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("id", id)
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!space) notFound();

  const now = new Date();
  const today = toTokyoDate(now);
  const [{ data: ruleRows }, { data: closureRows }, { data: busyRows }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("weekday, open_time, close_time")
      .eq("space_id", id)
      .order("open_time"),
    supabase.from("closures").select("date").eq("space_id", id).gte("date", today).order("date"),
    supabase.rpc("space_busy_periods", {
      p_space_id: id,
      p_from: tokyoToUtc(today, 0).toISOString(),
      p_to: tokyoToUtc(addDays(today, PREVIEW_DAYS), 0).toISOString(),
    }),
  ]);

  const rules: AvailabilityRule[] = (ruleRows ?? []).map((r) => ({
    weekday: r.weekday,
    openTime: minutesToTime(timeToMinutes(r.open_time)),
    closeTime: r.close_time === "00:00:00" ? "24:00" : minutesToTime(timeToMinutes(r.close_time)),
  }));
  const closures = (closureRows ?? []).map((c) => c.date);
  const busy = (busyRows ?? []).map((b) => ({
    start: new Date(b.period_start),
    end: new Date(b.period_end),
  }));

  // 空き枠のプレビュー（利用者サイトと同じ packages/core の計算）
  const preview = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const slots = computeDaySlots({ date, rules, closures, busy, now });
    return {
      date,
      closed: closures.includes(date),
      total: slots.length,
      available: slots.filter((s) => s.status === "available").length,
      booked: slots.filter((s) => s.status === "booked").length,
      label: formatTokyoDateTime(tokyoToUtc(date, 0)).slice(0, 13),
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/spaces" className="text-sm text-brand-700 underline">
        スペース一覧
      </Link>
      <h1 className="text-2xl font-bold">{space.name}</h1>
      <SpaceTabs spaceId={id} current="availability" />
      <Card className="space-y-3">
        <h2 className="font-bold">営業時間</h2>
        <p className="text-xs text-zinc-500">
          曜日ごとに2つまで時間帯を設定できます（昼休みなど）。30分単位です。
        </p>
        <RulesForm spaceId={id} rules={rules} />
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">休業日</h2>
        <ClosureForm spaceId={id} />
        <ul className="divide-y text-sm">
          {closures.map((date) => (
            <li key={date} className="flex items-center justify-between py-1">
              <span>{formatTokyoDateTime(tokyoToUtc(date, 0)).slice(0, 13)}</span>
              <form action={deleteClosureAction}>
                <input type="hidden" name="spaceId" value={id} />
                <input type="hidden" name="date" value={date} />
                <button type="submit" className="text-xs text-red-600 underline">
                  取り消す
                </button>
              </form>
            </li>
          ))}
          {closures.length === 0 && <li className="py-1 text-zinc-500">休業日はありません。</li>}
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">空き枠（今後{PREVIEW_DAYS}日）</h2>
        <table className="w-full text-sm">
          <tbody>
            {preview.map((d) => (
              <tr key={d.date} className="border-b last:border-0">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">
                  {d.closed
                    ? "休業日"
                    : d.total === 0
                      ? "営業時間外"
                      : `空き ${d.available} 枠 / 予約済み ${d.booked} 枠`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
