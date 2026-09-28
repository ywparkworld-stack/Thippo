import Link from "next/link";
import { formatTokyoDateTime } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";

const TABS = [
  { status: "pending", label: "審査待ち" },
  { status: "approved", label: "承認済み" },
  { status: "rejected", label: "却下" },
] as const;

export default async function HostApplicationsPage(props: PageProps<"/host-applications">) {
  const { supabase } = await requireAppSession("admin", "/host-applications");
  const searchParams = await props.searchParams;
  const status = TABS.find((t) => t.status === searchParams.status)?.status ?? "pending";
  const { data: apps } = await supabase
    .from("host_applications")
    .select("id, company_name, contact_name, email, created_at")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);

  return (
    <div className="space-y-4">
      {searchParams.reviewed === "approved" && (
        <Notice tone="success">
          承認しました。担当者に貸出主センターへの招待メールを送りました。
        </Notice>
      )}
      {searchParams.reviewed === "rejected" && <Notice tone="success">却下しました。</Notice>}
      <h1 className="text-2xl font-bold">掲載申込</h1>
      <nav className="flex gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/host-applications?status=${t.status}`}
            className={
              t.status === status
                ? "rounded-md bg-brand-600 px-3 py-1 text-white"
                : "rounded-md border px-3 py-1"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-4 py-2">申込日時</th>
              <th className="px-4 py-2">会社名</th>
              <th className="px-4 py-2">担当者</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(apps ?? []).map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-4 py-2">{formatTokyoDateTime(new Date(a.created_at))}</td>
                <td className="px-4 py-2">{a.company_name}</td>
                <td className="px-4 py-2">
                  {a.contact_name}
                  <br />
                  <span className="text-xs text-zinc-500">{a.email}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/host-applications/${a.id}`} className="text-brand-700 underline">
                    {status === "pending" ? "審査する" : "詳細"}
                  </Link>
                </td>
              </tr>
            ))}
            {(apps ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  該当する申込はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
