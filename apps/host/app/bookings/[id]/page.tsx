import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, formatYen } from "@thippo/ui";
import { requireHost } from "../../lib/host";
import { BOOKING_STATUS_LABELS, CANCELLED_BY_LABELS, periodLabel } from "../../lib/format";
import { HostCancelForm, NoShowForm } from "./forms";

export default async function BookingPage(props: PageProps<"/bookings/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireHost(`/bookings/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await props.searchParams;
  const { data } = await supabase.rpc("host_bookings", { p_booking_id: id, p_limit: 1 });
  const b = data?.[0];
  if (!b) notFound();
  const now = new Date();
  const started = new Date(b.period_start) <= now;
  const finished = new Date(b.period_end) <= now;
  const hostPayout = b.total - b.application_fee - (b.transfer_reversal_amount ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/bookings" className="text-sm text-brand-700 underline">
        予約一覧
      </Link>
      {sp.cancelled === "1" && (
        <Notice tone="success">
          キャンセルしました。利用者に全額を返金し、メールでお知らせしました。
        </Notice>
      )}
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">{b.space_name}</h1>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-500">利用日時</dt>
          <dd>{periodLabel(b.period_start, b.period_end)}</dd>
          <dt className="text-zinc-500">利用者</dt>
          <dd>{b.guest_name} 様</dd>
          <dt className="text-zinc-500">注文番号</dt>
          <dd className="font-mono">{b.order_number}</dd>
          <dt className="text-zinc-500">状態</dt>
          <dd>
            {BOOKING_STATUS_LABELS[b.status]}
            {b.cancelled_by && `（${CANCELLED_BY_LABELS[b.cancelled_by]}）`}
          </dd>
          {b.cancel_reason && (
            <>
              <dt className="text-zinc-500">キャンセルの理由</dt>
              <dd className="whitespace-pre-wrap">{b.cancel_reason}</dd>
            </>
          )}
          <dt className="text-zinc-500">利用料金</dt>
          <dd>{formatYen(b.total)}</dd>
          <dt className="text-zinc-500">手数料</dt>
          <dd>{formatYen(b.application_fee)}（運営手数料・決済手数料）</dd>
          {b.refund_amount !== null && (
            <>
              <dt className="text-zinc-500">返金額</dt>
              <dd>{formatYen(b.refund_amount)}</dd>
            </>
          )}
          <dt className="text-zinc-500">手取り</dt>
          <dd className="font-bold">{formatYen(hostPayout)}</dd>
        </dl>
      </Card>
      {b.status === "confirmed" && !finished && (
        <Card className="space-y-3">
          <h2 className="font-bold">貸出主都合のキャンセル</h2>
          <p className="text-sm text-zinc-600">
            利用者には全額を返金します。キャンセルの理由は利用者へのメールに記載されます。
          </p>
          <HostCancelForm bookingId={b.booking_id} />
        </Card>
      )}
      {b.status === "confirmed" && started && (
        <Card className="space-y-3">
          <h2 className="font-bold">無断キャンセルの記録</h2>
          <p className="text-sm text-zinc-600">
            利用者が連絡なく利用しなかった場合に記録します。返金はありません。
          </p>
          <NoShowForm bookingId={b.booking_id} />
        </Card>
      )}
    </div>
  );
}
