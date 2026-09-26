import { Card } from "@thippo/ui";

export default function HostApplyDonePage() {
  return (
    <Card className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-bold">お申し込みを受け付けました</h1>
      <p className="text-sm text-zinc-700">
        受付のメールをお送りしました。内容を確認のうえ、運営よりご連絡いたします。
      </p>
    </Card>
  );
}
