import Link from "next/link";
import { IDENTITY_DOCUMENT_LABELS, formatTokyoDateTime } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";
import { IDENTITY_STATUS_LABELS } from "../identity-status";
import { IdentityUploadForm } from "./upload-form";

export default async function IdentityPage(props: PageProps<"/mypage/identity">) {
  const { supabase, userId } = await requireAppSession("guest", "/mypage/identity");
  const searchParams = await props.searchParams;
  const [{ data: profile }, { data: docs }] = await Promise.all([
    supabase.from("profiles").select("identity_status").eq("id", userId).single(),
    supabase
      .from("identity_documents")
      .select("id, document_type, status, submitted_at, reject_reason, back_side_requested")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(10),
  ]);
  const status = profile?.identity_status ?? "unsubmitted";
  const latest = docs?.[0];
  const canSubmit = status === "unsubmitted" || status === "rejected";
  const backRequired = latest?.status === "rejected" && latest.back_side_requested;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {searchParams.submitted === "1" && (
        <Notice tone="success">
          本人確認書類を提出しました。審査の結果はメールでお知らせします。
        </Notice>
      )}
      <Card className="space-y-3">
        <h1 className="text-xl font-bold">本人確認</h1>
        <p className="text-sm">
          状態：<span className="font-semibold">{IDENTITY_STATUS_LABELS[status]}</span>
        </p>
        <p className="text-sm text-zinc-600">スペースの予約には、本人確認書類の確認が必要です。</p>
        {status === "rejected" && latest?.reject_reason && (
          <Notice tone="warning">
            <p className="font-semibold">前回の書類を確認できませんでした</p>
            <p className="mt-1 whitespace-pre-wrap">{latest.reject_reason}</p>
            {backRequired && (
              <p className="mt-1">再提出の際は、表面と裏面の両方を提出してください。</p>
            )}
          </Notice>
        )}
      </Card>

      {canSubmit && (
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">書類の提出</h2>
          <IdentityUploadForm userId={userId} backRequired={backRequired} />
        </Card>
      )}

      {docs && docs.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-lg font-bold">提出の履歴</h2>
          <ul className="divide-y divide-zinc-100 text-sm">
            {docs.map((d) => (
              <li key={d.id} className="flex justify-between py-2">
                <span>
                  {formatTokyoDateTime(new Date(d.submitted_at))}　
                  {IDENTITY_DOCUMENT_LABELS[d.document_type]}
                </span>
                <span>
                  {d.status === "pending"
                    ? "審査中"
                    : d.status === "approved"
                      ? "確認済み"
                      : "却下"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Link href="/mypage" className="text-sm text-brand-700 underline">
        マイページに戻る
      </Link>
    </div>
  );
}
