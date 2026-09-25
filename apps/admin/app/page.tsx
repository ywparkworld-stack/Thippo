import { Card } from "@thippo/ui";

export default function Home() {
  return (
    <Card>
      <h1 className="text-2xl font-bold">運営管理</h1>
      <p className="mt-4 text-sm text-zinc-500">
        ログイン（2段階認証必須）はフェーズ2で実装します。
      </p>
    </Card>
  );
}
