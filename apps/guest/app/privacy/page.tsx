import { Card } from "@thippo/ui";

export const metadata = { title: "プライバシーポリシー｜thippo" };

// TODO(要確認): 本文は運営が用意する（SPEC §16）。フェーズ10で静的ページとして整える。
export default function Page() {
  return (
    <Card className="space-y-3">
      <h1 className="text-xl font-bold">プライバシーポリシー</h1>
      <p className="text-sm text-zinc-600">本文は準備中です。</p>
    </Card>
  );
}
