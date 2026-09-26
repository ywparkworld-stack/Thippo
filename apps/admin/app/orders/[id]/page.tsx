import Link from "next/link";
import { notFound } from "next/navigation";
import { parseTstzRange } from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { adminRefundBookingAction, retryRefundAction } from "../../actions/admin";
import { ActionForm } from "../../_components/action-form";
import {
  BOOKING_STATUS_LABELS,
  CANCELLED_BY_LABELS,
  ORDER_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  dt,
  isUuid,
  periodLabel,
  stripePaymentUrl,
} from "../../lib/format";

interface Fees {
  hours: number;
  platform_fee_excl_tax: number;
  platform_fee_tax: number;
  stripe_fee_estimated: number;
  application_fee: number;
}
interface Refund {
  id: string;
  policy: string;
  refund_amount: number;
  transfer_reversal_amount: number;
  status: "pending" | "succeeded" | "failed";
  failure_reason: string | null;
  stripe_refund_id: string | null;
  stripe_transfer_reversal_id: string | null;
}

/** 注文の詳細：予約ごとの application fee・返金額・差し戻し額・貸出主の手取り（SPEC §10） */
export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAppSession("admin", `/orders/${id}`);
  const [{ data: o }, { data: bookings }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, profiles!orders_guest_id_fkey(id, email, display_name), hosts(id, company_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, period, slots, total, status, cancelled_by, cancel_reason, spaces(name), booking_fees(*), refunds(*)",
      )
      .eq("order_id", id)
      .order("period"),
  ]);
  if (!o) notFound();
  const guest = o.profiles as { id: string; email: string; display_name: string | null } | null;
  const host = o.hosts as { id: string; company_name: string } | null;
  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm text-brand-700 underline">
        注文一覧
      </Link>
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">注文番号 {o.order_number}</h1>
        <dl className="grid grid-cols-[12rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">状態</dt>
          <dd>{ORDER_STATUS_LABELS[o.status]}</dd>
          <dt className="text-zinc-500">利用者</dt>
          <dd>
            {guest && (
              <Link href={`/users/${guest.id}`} className="underline">
                {guest.display_name ?? guest.email}（{guest.email}）
              </Link>
            )}
          </dd>
          <dt className="text-zinc-500">貸出主</dt>
          <dd>
            {host && (
              <Link href={`/hosts/${host.id}`} className="underline">
                {host.company_name}
              </Link>
            )}
          </dd>
          <dt className="text-zinc-500">金額 / application fee</dt>
          <dd>
            {formatYen(o.total)} / {formatYen(o.application_fee_amount)}
          </dd>
          <dt className="text-zinc-500">決済手数料（実額）</dt>
          <dd>{o.stripe_fee_actual === null ? "未取得" : formatYen(o.stripe_fee_actual)}</dd>
          <dt className="text-zinc-500">注文・支払い</dt>
          <dd>
            {dt(o.created_at)} / {dt(o.paid_at)}
          </dd>
          {o.stripe_payment_intent_id && (
            <>
              <dt className="text-zinc-500">Stripe</dt>
              <dd>
                <a
                  href={stripePaymentUrl(o.stripe_payment_intent_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 underline"
                >
                  決済画面を開く
                </a>
                <span className="ml-2 font-mono text-xs text-zinc-500">
                  {o.stripe_payment_intent_id}
                </span>
              </dd>
            </>
          )}
          {o.late_payment_refunded_at && (
            <>
              <dt className="text-zinc-500">期限切れ後の支払い</dt>
              <dd>全額返金済み（{dt(o.late_payment_refunded_at)}）</dd>
            </>
          )}
        </dl>
      </Card>
      {(bookings ?? []).map((b) => {
        const { start, end } = parseTstzRange(b.period);
        const f = b.booking_fees as unknown as Fees;
        const r = b.refunds as unknown as Refund | null;
        const hostNet = b.total - f.application_fee - (r?.transfer_reversal_amount ?? 0);
        const platformNet =
          f.application_fee +
          (r?.transfer_reversal_amount ?? 0) -
          (r?.refund_amount ?? 0) -
          f.stripe_fee_estimated;
        return (
          <Card key={b.id} className="space-y-3">
            <div className="flex justify-between">
              <h2 className="font-bold">{(b.spaces as { name: string } | null)?.name}</h2>
              <span className="text-sm">
                {BOOKING_STATUS_LABELS[b.status]}
                {b.cancelled_by && `（${CANCELLED_BY_LABELS[b.cancelled_by]}）`}
              </span>
            </div>
            <p className="text-sm">{periodLabel(start, end)}</p>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="text-zinc-500">利用料金</td>
                  <td className="text-right">{formatYen(b.total)}</td>
                </tr>
                <tr>
                  <td className="text-zinc-500">運営手数料（税抜・税）</td>
                  <td className="text-right">
                    {formatYen(f.platform_fee_excl_tax)}・{formatYen(f.platform_fee_tax)}（{f.hours}
                    時間）
                  </td>
                </tr>
                <tr>
                  <td className="text-zinc-500">決済手数料（見込み）</td>
                  <td className="text-right">{formatYen(f.stripe_fee_estimated)}</td>
                </tr>
                <tr>
                  <td className="text-zinc-500">application fee</td>
                  <td className="text-right">{formatYen(f.application_fee)}</td>
                </tr>
                {r && (
                  <>
                    <tr>
                      <td className="text-zinc-500">返金額（{r.policy}）</td>
                      <td className="text-right">{formatYen(r.refund_amount)}</td>
                    </tr>
                    <tr>
                      <td className="text-zinc-500">差し戻し額</td>
                      <td className="text-right">{formatYen(r.transfer_reversal_amount)}</td>
                    </tr>
                    <tr>
                      <td className="text-zinc-500">返金の状態</td>
                      <td className="text-right">
                        {REFUND_STATUS_LABELS[r.status]}
                        {r.failure_reason && `：${r.failure_reason}`}
                      </td>
                    </tr>
                  </>
                )}
                <tr className="font-bold">
                  <td>貸出主の手取り</td>
                  <td className="text-right">{formatYen(hostNet)}</td>
                </tr>
                <tr>
                  <td className="text-zinc-500">運営の手取り（見込み）</td>
                  <td className="text-right">{formatYen(platformNet)}</td>
                </tr>
              </tbody>
            </table>
            {b.cancel_reason && (
              <p className="text-sm text-zinc-600">キャンセルの理由：{b.cancel_reason}</p>
            )}
            {r?.status === "failed" && (
              <ActionForm
                action={retryRefundAction}
                hidden={{ refundId: r.id }}
                label="返金を再実行する"
                withReason={false}
              />
            )}
            {b.status === "confirmed" && new Date(end) > new Date() && (
              <details>
                <summary className="cursor-pointer text-sm text-red-700">
                  運営判断で全額返金する
                </summary>
                <div className="mt-2">
                  <ActionForm
                    action={adminRefundBookingAction}
                    hidden={{ bookingId: b.id, orderId: o.id }}
                    label="キャンセルして全額返金する"
                    variant="danger"
                    confirmText="この予約をキャンセルし、利用者に全額返金します。よろしいですか？"
                  />
                </div>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}
