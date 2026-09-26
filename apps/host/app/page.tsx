import { requireAppSession } from "@thippo/auth/server";
import { Card, Notice } from "@thippo/ui";

export default async function Home(props: PageProps<"/">) {
  await requireAppSession("host", "/");
  const searchParams = await props.searchParams;
  return (
    <div className="space-y-4">
      {searchParams.password === "updated" && (
        <Notice tone="success">パスワードを設定しました。</Notice>
      )}
      <Card>
        <h1 className="text-2xl font-bold">貸出主センター</h1>
        <p className="mt-4 text-sm text-zinc-500">ダッシュボードはフェーズ8で実装します。</p>
      </Card>
    </div>
  );
}
