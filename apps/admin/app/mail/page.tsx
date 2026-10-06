import { requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { mailModeFromEnv } from "@thippo/mail";
import { Card, Notice } from "@thippo/ui";
import { discardMailAction, markMailSentAction } from "../actions/operations";
import { ActionForm } from "../_components/action-form";
import { dt } from "../lib/format";
import { CopyButton } from "./copy-button";

export const metadata = { title: "送信待ちのメール｜thippo 運営管理" };

/**
 * 送信待ちのメール（付録 D39）。メール送信サービスを使わない間、アプリが作ったメールはここに溜まる。
 * 運営が内容をコピーして自分のメールソフトから送り、「送信済みにする」を押す。
 */
export default async function MailPage() {
  await requireAppSession("admin", "/mail");
  const service = createSupabaseServiceClient();
  const [{ data: queued }, { data: recent }] = await Promise.all([
    service
      .from("notifications")
      .select("id, to_email, subject, body, template, created_at")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(100),
    service
      .from("notifications")
      .select("id, to_email, subject, status, sent_at, error, created_at")
      .neq("status", "queued")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const mode = mailModeFromEnv();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">送信待ちのメール（{queued?.length ?? 0}件）</h1>
      {mode === "manual" ? (
        <p className="text-sm text-zinc-700">
          メールは自動では送られません。古い順に、宛先・件名・本文をコピーして運営のメールアドレスから送り、「送信済みにする」を押してください。
          会員登録の確認・パスワード再設定・貸出主の招待のメールは Supabase
          から自動で送られるため、ここには出ません。
        </p>
      ) : (
        <Notice tone="info">
          現在はメールを自動で送る設定です（{mode === "resend" ? "Resend" : "ログに出力"}
          ）。ここに残っているのは、設定を変える前に作られたメールです。
        </Notice>
      )}

      {(queued ?? []).map((m) => (
        <Card key={m.id} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <dl className="grid grid-cols-[4rem_1fr] gap-y-1">
              <dt className="text-zinc-500">宛先</dt>
              <dd className="font-mono">{m.to_email}</dd>
              <dt className="text-zinc-500">件名</dt>
              <dd className="font-bold">{m.subject}</dd>
              <dt className="text-zinc-500">作成</dt>
              <dd>{dt(m.created_at)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={m.to_email} label="宛先をコピー" />
              <CopyButton text={m.subject} label="件名をコピー" />
              <CopyButton text={m.body ?? ""} label="本文をコピー" />
            </div>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-zinc-50 p-3 text-xs">
            {m.body ?? "（本文が記録されていません）"}
          </pre>
          <div className="grid gap-3 md:grid-cols-2">
            <ActionForm
              action={markMailSentAction}
              hidden={{ notificationId: m.id }}
              label="送信済みにする"
              withReason={false}
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-600">送らない場合</summary>
              <div className="pt-2">
                <ActionForm
                  action={discardMailAction}
                  hidden={{ notificationId: m.id }}
                  label="送らずに一覧から外す"
                  variant="danger"
                />
              </div>
            </details>
          </div>
        </Card>
      ))}
      {(queued ?? []).length === 0 && (
        <Card className="text-center text-sm text-zinc-500">送信待ちのメールはありません。</Card>
      )}

      <h2 className="pt-4 text-lg font-bold">最近処理したメール</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2">作成</th>
              <th className="px-3 py-2">宛先</th>
              <th className="px-3 py-2">件名</th>
              <th className="px-3 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">{dt(m.created_at)}</td>
                <td className="px-3 py-2 font-mono">{m.to_email}</td>
                <td className="px-3 py-2">{m.subject}</td>
                <td className="px-3 py-2">
                  {m.status === "sent" ? `送信済み（${dt(m.sent_at)}）` : (m.error ?? "失敗")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
