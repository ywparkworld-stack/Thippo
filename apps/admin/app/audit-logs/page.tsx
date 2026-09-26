import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { dt, isUuid } from "../lib/format";

const PAGE_SIZE = 100;

/** 操作ログの閲覧と検索（SPEC §10） */
export default async function AuditLogsPage(props: PageProps<"/audit-logs">) {
  const { supabase } = await requireAppSession("admin", "/audit-logs");
  const sp = await props.searchParams;
  const action = typeof sp.action === "string" ? sp.action.trim().slice(0, 100) : "";
  const actor = typeof sp.actor === "string" && isUuid(sp.actor) ? sp.actor : "";
  const target = typeof sp.target === "string" ? sp.target.trim().slice(0, 100) : "";
  const before =
    typeof sp.before === "string" && /^\d+$/.test(sp.before) ? Number(sp.before) : null;

  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, target_table, target_id, payload, created_at, profiles(email)")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (action) query = query.ilike("action", `%${action.replace(/[%_\\]/g, "\\$&")}%`);
  if (actor) query = query.eq("actor_id", actor);
  if (target) query = query.eq("target_id", target);
  if (before) query = query.lt("id", before);
  const { data: logs } = await query;
  const last = logs?.at(-1)?.id;
  const params = new URLSearchParams({ action, actor, target });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">操作ログ</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <input
          name="action"
          defaultValue={action}
          placeholder="操作（例: admin.、identity.）"
          className="rounded-md border border-zinc-300 px-3 py-1.5"
        />
        <input
          name="actor"
          defaultValue={actor}
          placeholder="操作者の id"
          className="w-72 rounded-md border border-zinc-300 px-3 py-1.5"
        />
        <input
          name="target"
          defaultValue={target}
          placeholder="対象の id"
          className="w-72 rounded-md border border-zinc-300 px-3 py-1.5"
        />
        <button className="rounded-md border px-3 py-1.5">検索</button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2">日時</th>
              <th className="px-3 py-2">操作者</th>
              <th className="px-3 py-2">操作</th>
              <th className="px-3 py-2">対象</th>
              <th className="px-3 py-2">内容</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-b align-top last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">{dt(l.created_at)}</td>
                <td className="px-3 py-2">
                  {(l.profiles as { email: string } | null)?.email ?? "（システム）"}
                </td>
                <td className="px-3 py-2 font-mono">{l.action}</td>
                <td className="px-3 py-2 font-mono">
                  {l.target_table}
                  {l.target_id && `:${l.target_id}`}
                </td>
                <td className="max-w-md px-3 py-2 font-mono break-all">
                  {JSON.stringify(l.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {logs && logs.length === PAGE_SIZE && last && (
        <Link
          href={`/audit-logs?${params.toString()}&before=${last}`}
          className="text-sm text-brand-700 underline"
        >
          さらに古いログ
        </Link>
      )}
    </div>
  );
}
