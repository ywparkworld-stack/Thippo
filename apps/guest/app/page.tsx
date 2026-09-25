import { Card } from "@thippo/ui";

export default function Home() {
  return (
    <Card>
      <h1 className="text-2xl font-bold">thippo</h1>
      <p className="mt-2 text-zinc-600">空き会議室・空き部屋を30分単位で予約できます。</p>
      <p className="mt-4 text-sm text-zinc-500">スペースの一覧と検索はフェーズ5で実装します。</p>
    </Card>
  );
}
