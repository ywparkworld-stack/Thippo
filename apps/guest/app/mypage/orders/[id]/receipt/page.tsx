import { notFound } from "next/navigation";
import {
  formatTokyoDateTime,
  includedConsumptionTax,
  minutesToTime,
  toTokyoMinutes,
  toTokyoDate,
} from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { formatYen } from "@thippo/ui";
import { loadOwnOrder } from "../../../../lib/orders";
import { PrintButton } from "./print-button";

export const metadata = { title: "領収書｜thippo" };

/**
 * 領収書（SPEC §6。付録 D9・D21: 発行者は運営、但し書きは「スペース利用料として」）。
 * TODO(要確認): 運営の会社名・住所・適格請求書発行事業者の登録番号（SPEC §16）。環境変数で設定する。
 */
export default async function ReceiptPage(props: PageProps<"/mypage/orders/[id]/receipt">) {
  const { id } = await props.params;
  const { supabase, userId } = await requireAppSession("guest", `/mypage/orders/${id}/receipt`);
  const order = await loadOwnOrder(supabase, id);
  if (!order || order.status !== "paid" || !order.paid_at) notFound();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  const issuer = {
    name: process.env.OPERATOR_COMPANY_NAME ?? "（運営会社名）",
    address: process.env.OPERATOR_ADDRESS ?? "（運営会社の住所）",
    registrationNumber: process.env.OPERATOR_INVOICE_REGISTRATION_NUMBER ?? "（登録番号）",
  };
  // 金額は支払額のまま表示し、返金は別に記載する（付録 D23）
  const amount = order.total;
  const refunds = order.bookings.filter((b) => b.refund && b.refund.refund_amount > 0);
  const tax = includedConsumptionTax(amount);
  const time = (iso: string) => minutesToTime(toTokyoMinutes(new Date(iso)));

  return (
    <div className="mx-auto max-w-2xl space-y-6 bg-white p-8 print:p-0">
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-bold tracking-widest">領収書</h1>
        <div className="text-right text-sm">
          <p>No. {order.order_number}</p>
          <p>発行日：{toTokyoDate(new Date()).replaceAll("-", "/")}</p>
        </div>
      </div>
      <p className="border-b pb-1 text-lg">{profile?.display_name ?? ""} 様</p>
      <div className="rounded border p-4 text-center">
        <p className="text-3xl font-bold">{formatYen(amount)}-</p>
        <p className="text-sm">（税込）</p>
      </div>
      <p className="text-sm">
        但し　スペース利用料として（お支払い日{" "}
        {formatTokyoDateTime(new Date(order.paid_at)).slice(0, 13)}）
      </p>
      <table className="w-full text-sm">
        <thead className="border-b text-left">
          <tr>
            <th className="py-1">内容</th>
            <th className="py-1 text-right">金額（税込）</th>
          </tr>
        </thead>
        <tbody>
          {order.bookings
            .filter((b) => b.status !== "expired")
            .map((b) => (
              <tr key={b.id} className="border-b">
                <td className="py-1">
                  {b.space?.name}　{formatTokyoDateTime(new Date(b.start))}〜{time(b.end)}
                </td>
                <td className="py-1 text-right">{formatYen(b.total)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <dl className="ml-auto grid w-64 grid-cols-2 gap-y-1 text-sm">
        <dt>10%対象（税込）</dt>
        <dd className="text-right">{formatYen(amount)}</dd>
        <dt>うち消費税</dt>
        <dd className="text-right">{formatYen(tax)}</dd>
      </dl>
      {refunds.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="font-bold">返金</p>
          {refunds.map((b) => (
            <p key={b.id}>
              {b.space?.name}（キャンセル）：{formatYen(b.refund!.refund_amount)}
              {b.refund!.status === "succeeded" && b.refund!.completed_at
                ? `　返金日 ${toTokyoDate(new Date(b.refund!.completed_at)).replaceAll("-", "/")}`
                : "　返金手続き中"}
            </p>
          ))}
        </div>
      )}
      <div className="space-y-1 border-t pt-4 text-sm">
        <p className="font-bold">{issuer.name}</p>
        <p>{issuer.address}</p>
        <p>登録番号：{issuer.registrationNumber}</p>
        <p className="text-xs text-zinc-600">
          上記金額は、{order.companyName}（貸出主）に代わって受領しました（代理受領）。
        </p>
      </div>
      <PrintButton />
    </div>
  );
}
