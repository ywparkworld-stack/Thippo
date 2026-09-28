import { Card } from "@thippo/ui";

export default function WithdrawnPage() {
  return (
    <Card className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-bold">退会の手続きが完了しました</h1>
      <p className="text-sm text-zinc-700">
        これまで thippo をご利用いただき、ありがとうございました。
      </p>
    </Card>
  );
}
