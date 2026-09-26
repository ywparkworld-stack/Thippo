import Link from "next/link";
import { z } from "zod";
import { tokyoToUtc, addDays } from "@thippo/core";
import { Card, formatYen } from "@thippo/ui";
import { requireHost } from "../lib/host";
import { BOOKING_STATUS_LABELS, periodLabel } from "../lib/format";

const filterSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  space: z.uuid().optional().catch(undefined),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional().catch(undefined),
});

/** 予約一覧（日付・スペース・状態で絞り込み。SPEC §9） */
export default async function BookingsPage(props: PageProps<"/bookings">) {
  const { supabase, host } = await requireHost("/bookings");
  const sp = await props.searchParams;
  const f = filterSchema.parse({
    from: typeof sp.from === "string" && sp.from ? sp.from : undefined,
    to: typeof sp.to === "string" && sp.to ? sp.to : undefined,
    space: typeof sp.space === "string" && sp.space ? sp.space : undefined,
    status: typeof sp.status === "string" && sp.status ? sp.status : undefined,
  });
  const [{ data: bookings }, { data: spaces }] = await Promise.all([
    supabase.rpc("host_bookings", {
      p_from: f.from ? tokyoToUtc(f.from, 0).toISOString() : undefined,
      p_to: f.to ? tokyoToUtc(addDays(f.to, 1), 0).toISOString() : undefined,
      p_space_id: f.space,
      p_status: f.status,
      p_limit: 500,
    }),
    supabase
      .from("spaces")
      .select("id, name")
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .order("name"),
  ]);
  const select = "rounded-md border border-zinc-300 px-2 py-1 text-sm";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">予約</h1>
      <Card>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="space-y-1">
            <span className="block">利用日（から）</span>
            <input type="date" name="from" defaultValue={f.from} className={select} />
          </label>
          <label className="space-y-1">
            <span className="block">利用日（まで）</span>
            <input type="date" name="to" defaultValue={f.to} className={select} />
          </label>
          <label className="space-y-1">
            <span className="block">スペース</span>
            <select name="space" defaultValue={f.space ?? ""} className={select}>
              <option value="">すべて</option>
              {(spaces ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block">状態</span>
            <select name="status" defaultValue={f.status ?? ""} className={select}>
              <option value="">すべて</option>
              {(["confirmed", "cancelled", "completed", "no_show"] as const).map((s) => (
                <option key={s} value={s}>
                  {BOOKING_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-1.5 text-white">
            絞り込む
          </button>
        </form>
      </Card>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">利用日時</th>
              <th className="px-4 py-2">スペース</th>
              <th className="px-4 py-2">利用者</th>
              <th className="px-4 py-2 text-right">利用料金</th>
              <th className="px-4 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b) => (
              <tr key={b.booking_id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/bookings/${b.booking_id}`} className="text-brand-700 underline">
                    {periodLabel(b.period_start, b.period_end)}
                  </Link>
                </td>
                <td className="px-4 py-2">{b.space_name}</td>
                <td className="px-4 py-2">{b.guest_name}</td>
                <td className="px-4 py-2 text-right">{formatYen(b.total)}</td>
                <td className="px-4 py-2">{BOOKING_STATUS_LABELS[b.status]}</td>
              </tr>
            ))}
            {(bookings ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  該当する予約はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
