import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { dt } from "../lib/format";

const HOST_STATUS = { applied: "申込中", active: "有効", suspended: "停止中" } as const;

export default async function HostsPage(props: PageProps<"/hosts">) {
  const { supabase } = await requireAppSession("admin", "/hosts");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  let query = supabase
    .from("hosts")
    .select("id, company_name, status, charges_enabled, payouts_enabled, created_at, spaces(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("company_name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data: hosts } = await query;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">貸出主・スペース</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="会社名で検索"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <button className="rounded-md border px-3 py-1.5 text-sm">検索</button>
      </form>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">会社名</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">Stripe</th>
              <th className="px-4 py-2">スペース数</th>
              <th className="px-4 py-2">登録日</th>
            </tr>
          </thead>
          <tbody>
            {(hosts ?? []).map((h) => (
              <tr key={h.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/hosts/${h.id}`} className="text-brand-700 underline">
                    {h.company_name}
                  </Link>
                </td>
                <td className="px-4 py-2">{HOST_STATUS[h.status]}</td>
                <td className="px-4 py-2">
                  {h.charges_enabled && h.payouts_enabled ? "登録済み" : "未完了"}
                </td>
                <td className="px-4 py-2">
                  {(h.spaces as unknown as { count: number }[])[0]?.count ?? 0}
                </td>
                <td className="px-4 py-2">{dt(h.created_at).slice(0, 13)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
