import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CANCEL_POLICY_LINES,
  CANCELLATION,
  calcRefund,
  decideCancellation,
  formatTokyoDateTime,
  minutesToTime,
  parseTstzRange,
  toTokyoMinutes,
  type BookingFees,
} from "@thippo/core";
import { requireAppSession } from "@thippo/auth/server";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { Card, Notice, formatYen } from "@thippo/ui";
import { CancelForm } from "./cancel-form";

export const metadata = { title: "予約のキャンセル｜thippo" };

/**
 * キャンセルの確認画面（SPEC §8）。確定前に返金額と「過去24時間で◯回目のキャンセルです」を表示する。
 * ここでの金額は表示用の見込みで、確定時に DB 関数で判定し直す。
 */
export default async function CancelPage(props: PageProps<"/mypage/bookings/[id]/cancel">) {
  const { id } = await props.params;
  const { supabase, userId } = await requireAppSession("guest", `/mypage/bookings/${id}/cancel`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: b } = await supabase
    .from("bookings")
    .select(
      "id, order_id, period, slots, price_per_30min, total, status, spaces(name, address), booking_fees(hours, platform_fee_excl_tax, platform_fee_tax, stripe_fee_estimated, application_fee)",
    )
    .eq("id", id)
    .eq("guest_id", userId)
    .maybeSingle();
  if (!b) notFound();
  const { start, end } = parseTstzRange(b.period);
  const space = b.spaces as { name: string; address: string } | null;
  const back = (
    <Link href={`/mypage/orders/${b.order_id}`} className="text-sm text-brand-700 underline">
      注文に戻る
    </Link>
  );
  if (b.status !== "confirmed" || new Date(end) <= new Date()) {
    return (
      <Card className="mx-auto max-w-xl space-y-3">
        <h1 className="text-xl font-bold">予約のキャンセル</h1>
        <Notice tone="warning">この予約はキャンセルできません。</Notice>
        {back}
      </Card>
    );
  }

  const f = b.booking_fees as unknown as {
    hours: number;
    platform_fee_excl_tax: number;
    platform_fee_tax: number;
    stripe_fee_estimated: number;
    application_fee: number;
  };
  const fees: BookingFees = {
    slots: b.slots,
    hours: f.hours,
    pricePer30min: b.price_per_30min,
    subtotal: b.total,
    platformFeeExclTax: f.platform_fee_excl_tax,
    platformFeeTax: f.platform_fee_tax,
    stripeFeeEstimated: f.stripe_fee_estimated,
    applicationFee: f.application_fee,
    hostPayout: b.total - f.application_fee,
  };
  const { data: count } = await createSupabaseServiceClient().rpc("recent_guest_cancel_count", {
    p_guest_id: userId,
  });
  const recent = count ?? 0;
  const decision = decideCancellation({
    actor: "guest",
    now: new Date(),
    start: new Date(start),
    recentGuestCancelCount: recent,
  });
  const refund = calcRefund(fees, decision.policy);
  const nth = recent + 1;

  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">予約のキャンセル</h1>
      <div className="rounded border p-3 text-sm">
        <p className="font-bold">{space?.name}</p>
        <p>
          {formatTokyoDateTime(new Date(start))}〜{minutesToTime(toTokyoMinutes(new Date(end)))}
        </p>
        <p>利用料金：{formatYen(b.total)}</p>
      </div>
      <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
        <dt className="text-zinc-500">返金額</dt>
        <dd className="text-lg font-bold">{formatYen(refund.refundAmount)}</dd>
        <dt className="text-zinc-500">キャンセルの区分</dt>
        <dd>
          {decision.reason === "before_deadline" && "利用開始の2時間前まで（全額返金）"}
          {decision.reason === "within_deadline" && "利用開始の2時間前から利用開始まで（半額返金）"}
          {decision.reason === "after_start" && "利用開始後（返金なし）"}
          {decision.reason === "too_many_cancels" && "キャンセルの回数が多いため返金なし"}
        </dd>
      </dl>
      <Notice tone={nth > CANCELLATION.maxCancelsBeforeNoRefund ? "error" : "warning"}>
        過去24時間で{nth}回目のキャンセルです。{CANCELLATION.maxCancelsBeforeNoRefund + 1}
        回目以降は返金されません。
      </Notice>
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600">キャンセル規定</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
          {CANCEL_POLICY_LINES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
      <CancelForm bookingId={b.id} orderId={b.order_id} />
      {back}
    </Card>
  );
}
