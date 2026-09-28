import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTokyoDateTime } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { ReviewForms } from "./review-forms";

export default async function HostApplicationDetailPage(
  props: PageProps<"/host-applications/[id]">,
) {
  const { id } = await props.params;
  const { supabase } = await requireAppSession("admin", `/host-applications/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: a } = await supabase
    .from("host_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!a) notFound();

  const rows: [string, string | null][] = [
    ["申込日時", formatTokyoDateTime(new Date(a.created_at))],
    ["会社名・屋号", a.company_name],
    ["担当者", a.contact_name],
    ["メールアドレス", a.email],
    ["電話番号", a.phone],
    ["所在地", a.address],
    ["備考", a.note],
    ["状態", a.status === "pending" ? "審査待ち" : a.status === "approved" ? "承認済み" : "却下"],
    ["却下の理由", a.reject_reason],
  ];
  return (
    <div className="space-y-4">
      <Link href="/host-applications" className="text-sm text-brand-700 underline">
        一覧に戻る
      </Link>
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">掲載申込</h1>
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
        </dl>
      </Card>
      {a.status === "pending" && (
        <Card>
          <ReviewForms applicationId={a.id} />
        </Card>
      )}
    </div>
  );
}
