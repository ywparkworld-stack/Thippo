import Link from "next/link";
import { onboardingState } from "@thippo/payments";
import { Card, Notice } from "@thippo/ui";
import { requireHost } from "./lib/host";

export default async function Home(props: PageProps<"/">) {
  const { host } = await requireHost("/");
  const searchParams = await props.searchParams;
  const state = onboardingState(host);
  return (
    <div className="space-y-4">
      {searchParams.password === "updated" && (
        <Notice tone="success">パスワードを設定しました。</Notice>
      )}
      {state !== "complete" && (
        <Notice tone="warning">
          スペースを公開するには、会社情報と Stripe での入金先の登録が必要です。
          <Link href="/onboarding" className="ml-1 underline">
            登録へ進む
          </Link>
        </Notice>
      )}
      <Card>
        <h1 className="text-2xl font-bold">{host.company_name}</h1>
        <p className="mt-4 text-sm text-zinc-500">
          これからの予約・今月の売上見込みはフェーズ8で実装します。
        </p>
      </Card>
    </div>
  );
}
