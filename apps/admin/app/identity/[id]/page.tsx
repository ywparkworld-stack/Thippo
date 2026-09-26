import Link from "next/link";
import { notFound } from "next/navigation";
import { IDENTITY_DOCUMENT_LABELS, formatTokyoDateTime } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { DocumentViewer } from "./document-viewer";
import { ReviewForm } from "./review-form";

export default async function IdentityDetailPage(props: PageProps<"/identity/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAppSession("admin", `/identity/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: doc } = await supabase
    .from("identity_documents")
    .select(
      "id, user_id, document_type, status, submitted_at, reviewed_at, reject_reason, back_side_requested, back_path, profiles!identity_documents_user_id_fkey(display_name, email, phone, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();
  const p = doc.profiles as {
    display_name: string | null;
    email: string;
    phone: string | null;
    created_at: string;
  } | null;

  const { data: history } = await supabase
    .from("identity_documents")
    .select("id, status, submitted_at, reject_reason")
    .eq("user_id", doc.user_id)
    .neq("id", doc.id)
    .order("submitted_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-4">
      <Link href="/identity" className="text-sm text-brand-700 underline">
        一覧に戻る
      </Link>
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">本人確認書類</h1>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">利用者</dt>
          <dd>
            {p?.display_name ?? "（未設定）"}（{p?.email}）
          </dd>
          <dt className="text-zinc-500">電話番号</dt>
          <dd>{p?.phone ?? "—"}</dd>
          <dt className="text-zinc-500">書類</dt>
          <dd>
            {IDENTITY_DOCUMENT_LABELS[doc.document_type]}（
            {doc.back_path ? "表面・裏面" : "表面のみ"}）
          </dd>
          <dt className="text-zinc-500">提出日時</dt>
          <dd>{formatTokyoDateTime(new Date(doc.submitted_at))}</dd>
          <dt className="text-zinc-500">状態</dt>
          <dd>
            {doc.status === "pending"
              ? "審査待ち"
              : doc.status === "approved"
                ? "承認済み"
                : "却下"}
          </dd>
          {doc.reject_reason && (
            <>
              <dt className="text-zinc-500">却下の理由</dt>
              <dd className="whitespace-pre-wrap">
                {doc.reject_reason}
                {doc.back_side_requested && "（両面の提出を依頼）"}
              </dd>
            </>
          )}
        </dl>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">書類の画像</h2>
        <DocumentViewer documentId={doc.id} />
      </Card>
      {doc.status === "pending" && (
        <Card className="space-y-3">
          <h2 className="font-bold">審査</h2>
          <ReviewForm documentId={doc.id} />
        </Card>
      )}
      {history && history.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-bold">この利用者の過去の提出</h2>
          <ul className="text-sm">
            {history.map((h) => (
              <li key={h.id}>
                {formatTokyoDateTime(new Date(h.submitted_at))}　
                {h.status === "approved"
                  ? "承認"
                  : h.status === "rejected"
                    ? `却下：${h.reject_reason}`
                    : "審査待ち"}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
