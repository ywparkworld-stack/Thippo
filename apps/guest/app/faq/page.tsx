import { StaticPage } from "../_components/static-page";

export const metadata = { title: "よくある質問｜thippo" };

// TODO(要確認): よくある質問の本文（SPEC §16）
export default function FaqPage() {
  const faqs: [string, string][] = [
    [
      "予約に本人確認は必要ですか？",
      "はい。初めてのご予約の前に、マイページから本人確認書類を提出してください。確認には時間がかかる場合があります。",
    ],
    ["支払い方法は？", "クレジットカードのみです（Apple Pay・Google Pay もご利用いただけます）。"],
    [
      "複数のスペースをまとめて予約できますか？",
      "同じ貸出主のスペースであれば、予約カゴに入れてまとめて購入できます。貸出主が異なる場合は、別々にご購入ください。",
    ],
    [
      "キャンセルしたい",
      "マイページの予約履歴から、予約ごとにキャンセルできます。返金はキャンセル規定のとおりです。",
    ],
    ["領収書はもらえますか？", "マイページの予約履歴から領収書を表示・印刷できます。"],
  ];
  return (
    <StaticPage title="よくある質問">
      {faqs.map(([q, a]) => (
        <div key={q}>
          <h2>Q. {q}</h2>
          <p>A. {a}</p>
        </div>
      ))}
    </StaticPage>
  );
}
