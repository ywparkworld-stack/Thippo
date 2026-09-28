import { Card } from "@thippo/ui";

export default function ContactDonePage() {
  return (
    <Card className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-bold">お問い合わせを受け付けました</h1>
      <p className="text-sm text-zinc-700">
        受付のメールをお送りしました。担当者よりご連絡いたします。
      </p>
    </Card>
  );
}
