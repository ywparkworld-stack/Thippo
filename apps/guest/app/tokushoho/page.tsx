import { StaticPage } from "../_components/static-page";

export const metadata = { title: "特定商取引法に基づく表記｜thippo" };

// TODO(要確認): 特定商取引法に基づく表記の本文（SPEC §16）。運営の情報を記載する。
export default function TokushohoPage() {
  const rows: [string, string][] = [
    ["販売事業者", "（運営会社名）"],
    ["運営責任者", "（氏名）"],
    ["所在地", "（住所）"],
    ["お問い合わせ先", "お問い合わせフォームをご利用ください（メールアドレスは運営が記載します）"],
    ["販売価格", "各スペースのページに表示された金額（税込）"],
    ["商品代金以外の必要料金", "なし"],
    ["お支払い方法", "クレジットカード"],
    ["お支払い時期", "予約の手続きの時点"],
    ["サービスの提供時期", "予約した日時"],
    ["キャンセル・返金", "キャンセル規定のとおり"],
  ];
  return (
    <StaticPage title="特定商取引法に基づく表記">
      <dl className="grid grid-cols-[10rem_1fr] gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </StaticPage>
  );
}
