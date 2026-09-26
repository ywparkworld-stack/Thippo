import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { dt } from "../lib/format";

/** キャンセル監視：過去30日・過去24時間のキャンセル回数が多い利用者（SPEC §10） */
export default async function CancelMonitorPage(props: PageProps<"/cancel-monitor">) {
  const { supabase } = await requireAppSession("admin", "/cancel-monitor");
  const sp = await props.searchParams;
  const min = Math.min(Math.max(Number(sp.min) || 3, 1), 100);
  const { data: rows } = await supabase.rpc("admin_cancel_monitor", {
    p_min_30d: min,
    p_limit: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">キャンセル監視</h1>
      <form className="flex items-center gap-2 text-sm">
        過去30日で
        <input
          type="number"
          name="min"
          min={1}
          defaultValue={min}
          className="w-20 rounded-md border border-zinc-300 px-2 py-1"
        />
        回以上（または過去24時間で3回以上）
        <button className="rounded-md border px-3 py-1">表示</button>
      </form>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">利用者</th>
              <th className="px-4 py-2 text-right">過去24時間</th>
              <th className="px-4 py-2 text-right">過去30日</th>
              <th className="px-4 py-2">最後のキャンセル</th>
              <th className="px-4 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.user_id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/users/${r.user_id}`} className="text-brand-700 underline">
                    {r.display_name ?? r.email}
                  </Link>
                  <br />
                  <span className="text-xs text-zinc-500">{r.email}</span>
                </td>
                <td
                  className={`px-4 py-2 text-right ${r.cancels_24h >= 5 ? "font-bold text-red-700" : ""}`}
                >
                  {r.cancels_24h}
                </td>
                <td className="px-4 py-2 text-right">{r.cancels_30d}</td>
                <td className="px-4 py-2">{dt(r.last_cancel_at)}</td>
                <td className="px-4 py-2">{r.status === "active" ? "有効" : "停止中"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
