import { Card } from "@thippo/ui";
import { HostApplicationForm } from "./form";

export const metadata = { title: "掲載のお申し込み｜thippo" };

export default function HostApplyPage() {
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">掲載のお申し込み</h1>
      <p className="text-sm text-zinc-600">
        担当者のメールアドレスには、thippo の利用者として登録していないものをお使いください。
      </p>
      <HostApplicationForm />
    </Card>
  );
}
