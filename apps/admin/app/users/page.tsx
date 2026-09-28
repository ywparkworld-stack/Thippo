import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { ROLE_LABELS, dt } from "../lib/format";

const IDENTITY = {
  unsubmitted: "未提出",
  pending: "審査中",
  approved: "確認済み",
  rejected: "却下",
} as const;

/** 利用者の一覧・検索（SPEC §10） */
export default async function UsersPage(props: PageProps<"/users">) {
  const { supabase } = await requireAppSession("admin", "/users");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const role = sp.role === "host" ? "host" : "guest";
  let query = supabase
    .from("profiles")
    .select("id, display_name, email, role, identity_status, status, created_at")
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    const escaped = q.replace(/[%_\\,()]/g, "");
    query = query.or(`email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
  }
  const { data: users } = await query;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">利用者</h1>
      <form className="flex gap-2 text-sm">
        <select
          name="role"
          defaultValue={role}
          className="rounded-md border border-zinc-300 px-2 py-1.5"
        >
          <option value="guest">利用者</option>
          <option value="host">貸出主の担当者</option>
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="メールアドレス・名前"
          className="rounded-md border border-zinc-300 px-3 py-1.5"
        />
        <button className="rounded-md border px-3 py-1.5">検索</button>
      </form>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">名前</th>
              <th className="px-4 py-2">メールアドレス</th>
              <th className="px-4 py-2">種別</th>
              <th className="px-4 py-2">本人確認</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">登録日</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/users/${u.id}`} className="text-brand-700 underline">
                    {u.display_name ?? "（未設定）"}
                  </Link>
                </td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-2">{IDENTITY[u.identity_status]}</td>
                <td className="px-4 py-2">{u.status === "active" ? "有効" : "停止中"}</td>
                <td className="px-4 py-2">{dt(u.created_at).slice(0, 13)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
