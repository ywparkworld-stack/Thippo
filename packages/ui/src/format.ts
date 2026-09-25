/** 円の表示: 1234 → "¥1,234" */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}
