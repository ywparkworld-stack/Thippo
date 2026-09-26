import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";

export default async function Home(props: PageProps<"/">) {
  await requireAppSession("admin", "/");
  const searchParams = await props.searchParams;
  return (
    <div className="space-y-4">
      {searchParams.password === "updated" && (
        <Notice tone="success">パスワードを設定しました。</Notice>
      )}
      <Card>
        <h1 className="text-2xl font-bold">運営管理</h1>
        <p className="mt-4 text-sm text-zinc-500">ダッシュボードはフェーズ9で実装します。</p>
      </Card>
    </div>
  );
}
