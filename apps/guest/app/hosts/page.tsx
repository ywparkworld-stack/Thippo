import Link from "next/link";
import { minimumPricePer30min } from "@thippo/core";
import { Card } from "@thippo/ui";

export const metadata = { title: "スペースを掲載する｜thippo" };

export default function HostGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold">空いている会議室・部屋を、30分単位で貸し出しませんか</h1>
        <p className="text-zinc-700">
          thippo は、企業などの空き会議室・空き部屋を30分単位で貸し出せる予約サービスです。
          掲載料はかかりません。予約が入ったときだけ、運営手数料と決済手数料をいただきます。
        </p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">料金</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>運営手数料：利用1時間ごとに220円（税込。30分の端数は1時間に切り上げ）</li>
          <li>決済手数料：利用料金の3.6%（貸出主のご負担）</li>
          <li>
            30分あたりの料金は{minimumPricePer30min(1).toLocaleString("ja-JP")}
            円以上で設定できます（最低利用時間によって下限が変わります）
          </li>
          <li>売上は月ごとにまとめて、毎月23日にご登録の口座へ入金します</li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">掲載までの流れ</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>下のフォームから掲載をお申し込みください</li>
          <li>運営が内容を確認し、承認すると貸出主センターへの招待メールが届きます</li>
          <li>
            会社情報と、Stripe
            での入金先の登録を行います（法人・個人事業主のどちらでも登録できます）
          </li>
          <li>スペースの写真・営業時間・料金を登録して公開します</li>
        </ol>
        <Link
          href="/hosts/apply"
          className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm text-white"
        >
          掲載を申し込む
        </Link>
      </Card>
    </div>
  );
}
