import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";

export default async function MyPage(props: PageProps<"/mypage">) {
  const { supabase, userId } = await requireAppSession("guest", "/mypage");
  const searchParams = await props.searchParams;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, identity_status")
    .eq("id", userId)
    .single();
  return (
    <div className="space-y-4">
      {searchParams.password === "updated" && (
        <Notice tone="success">パスワードを変更しました。</Notice>
      )}
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">マイページ</h1>
        <p className="text-sm">{profile?.display_name ?? "（お名前未設定）"} 様</p>
        <p className="text-sm text-zinc-600">{profile?.email}</p>
        <p className="text-sm text-zinc-500">
          会員情報の編集・本人確認書類の提出はフェーズ3、予約履歴はフェーズ6以降で実装します。
        </p>
      </Card>
    </div>
  );
}
