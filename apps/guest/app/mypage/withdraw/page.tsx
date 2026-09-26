import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card } from "@thippo/ui";
import { WithdrawForm } from "./form";

export const metadata = { title: "退会｜thippo" };

export default async function WithdrawPage() {
  await requireAppSession("guest", "/mypage/withdraw");
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">退会</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
        <li>これからのご予約（お支払い待ちを含む）がある間は退会できません。</li>
        <li>退会すると、このアカウントではログインできなくなります。</li>
        <li>予約履歴・領収書も表示できなくなります。必要な領収書は退会前に保存してください。</li>
        <li>提出いただいた本人確認書類は、法令で定められた期間の保存のあと削除します。</li>
      </ul>
      <WithdrawForm />
      <Link href="/mypage" className="text-sm text-brand-700 underline">
        マイページに戻る
      </Link>
    </Card>
  );
}
