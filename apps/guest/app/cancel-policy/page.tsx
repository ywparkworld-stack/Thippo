import { CANCEL_POLICY_LINES } from "@thippo/core";
import { Card } from "@thippo/ui";

export const metadata = { title: "キャンセル規定｜thippo" };

// TODO(要確認): 正式な文面は運営が用意する（SPEC §16）。内容は SPEC §8 の返金ルールと一致させること。
export default function CancelPolicyPage() {
  return (
    <Card className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-xl font-bold">キャンセル規定</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
        {CANCEL_POLICY_LINES.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="text-sm text-zinc-600">
        キャンセルはマイページの予約履歴から、予約ごとに行えます。
      </p>
    </Card>
  );
}
