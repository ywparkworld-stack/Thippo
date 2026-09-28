import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";
import { IDENTITY_STATUS_LABELS } from "./identity-status";

export default async function MyPage(props: PageProps<"/mypage">) {
  const { supabase, userId } = await requireAppSession("guest", "/mypage");
  const searchParams = await props.searchParams;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, phone, identity_status")
    .eq("id", userId)
    .single();
  const identityStatus = profile?.identity_status ?? "unsubmitted";
  return (
    <div className="space-y-4">
      {searchParams.password === "updated" && (
        <Notice tone="success">パスワードを変更しました。</Notice>
      )}
      {identityStatus !== "approved" && (
        <Notice tone={identityStatus === "rejected" ? "warning" : "info"}>
          予約には本人確認が必要です（{IDENTITY_STATUS_LABELS[identityStatus]}）。
          <Link href="/mypage/identity" className="ml-1 underline">
            本人確認へ
          </Link>
        </Notice>
      )}
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">マイページ</h1>
        <p className="text-sm">{profile?.display_name ?? "（お名前未設定）"} 様</p>
        <p className="text-sm text-zinc-600">{profile?.email}</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-bold">会員情報</h2>
          <p className="text-sm text-zinc-600">お名前・電話番号</p>
          <Link href="/mypage/profile" className="text-sm text-brand-700 underline">
            編集する
          </Link>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">本人確認</h2>
          <p className="text-sm text-zinc-600">{IDENTITY_STATUS_LABELS[identityStatus]}</p>
          <Link href="/mypage/identity" className="text-sm text-brand-700 underline">
            確認・提出する
          </Link>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">予約履歴</h2>
          <p className="text-sm text-zinc-600">予約の確認・領収書</p>
          <Link href="/mypage/orders" className="text-sm text-brand-700 underline">
            見る
          </Link>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-bold">パスワード・退会</h2>
          <Link href="/password/reset" className="text-sm text-brand-700 underline">
            パスワードを変更する
          </Link>
          <br />
          <Link href="/mypage/withdraw" className="text-xs text-zinc-500 underline">
            退会する
          </Link>
        </Card>
      </div>
    </div>
  );
}
