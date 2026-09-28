import Link from "next/link";
import { IDENTITY_DOCUMENT_LABELS, formatTokyoDateTime } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";

const TABS = [
  { status: "pending", label: "審査待ち" },
  { status: "approved", label: "承認済み" },
  { status: "rejected", label: "却下" },
] as const;

export default async function IdentityListPage(props: PageProps<"/identity">) {
  const { supabase } = await requireAppSession("admin", "/identity");
  const searchParams = await props.searchParams;
  const status = TABS.find((t) => t.status === searchParams.status)?.status ?? "pending";

  const { data: docs } = await supabase
    .from("identity_documents")
    .select(
      "id, document_type, submitted_at, reviewed_at, profiles!identity_documents_user_id_fkey(display_name, email)",
    )
    .eq("status", status)
    .order("submitted_at", { ascending: status === "pending" })
    .limit(100);

  return (
    <div className="space-y-4">
      {searchParams.reviewed === "approved" && (
        <Notice tone="success">承認しました。利用者にメールで通知しました。</Notice>
      )}
      {searchParams.reviewed === "rejected" && (
        <Notice tone="success">却下しました。利用者にメールで通知しました。</Notice>
      )}
      <h1 className="text-2xl font-bold">本人確認の審査</h1>
      <nav className="flex gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/identity?status=${t.status}`}
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
              <th className="px-4 py-2">提出日時</th>
              <th className="px-4 py-2">利用者</th>
              <th className="px-4 py-2">書類</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => {
              const p = d.profiles as { display_name: string | null; email: string } | null;
              return (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{formatTokyoDateTime(new Date(d.submitted_at))}</td>
                  <td className="px-4 py-2">
                    {p?.display_name ?? "（未設定）"}
                    <br />
                    <span className="text-xs text-zinc-500">{p?.email}</span>
                  </td>
                  <td className="px-4 py-2">{IDENTITY_DOCUMENT_LABELS[d.document_type]}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/identity/${d.id}`}
                      prefetch={false}
                      className="text-brand-700 underline"
                    >
                      {status === "pending" ? "審査する" : "詳細"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(docs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  該当する書類はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
