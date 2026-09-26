import Link from "next/link";
import { requireAppSession } from "@thippo/auth/server";
import { Card, formatYen } from "@thippo/ui";
import { retryRefundAction } from "../actions/admin";
import { ActionForm } from "../_components/action-form";
import { dt } from "../lib/format";

/** 失敗した返金（SPEC §8.1）。運営が再実行する */
export default async function RefundsPage() {
  const { supabase } = await requireAppSession("admin", "/refunds");
  const { data: refunds } = await supabase
    .from("refunds")
    .select(
      "id, refund_amount, transfer_reversal_amount, failure_reason, attempts, created_at, stripe_refund_id, bookings(order_id, orders(order_number))",
    )
    .eq("status", "failed")
    .order("created_at")
    .limit(200);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">失敗した返金</h1>
      {(refunds ?? []).length === 0 && (
        <Card className="text-sm text-zinc-500">失敗した返金はありません。</Card>
      )}
      {(refunds ?? []).map((r) => {
        const b = r.bookings as {
          order_id: string;
          orders: { order_number: string } | null;
        } | null;
        return (
          <Card key={r.id} className="grid gap-3 md:grid-cols-[1fr_16rem]">
            <div className="space-y-1 text-sm">
              <Link href={`/orders/${b?.order_id}`} className="font-mono text-brand-700 underline">
                {b?.orders?.order_number}
              </Link>
              <p>
                返金 {formatYen(r.refund_amount)}（{r.stripe_refund_id ? "返金済み" : "未返金"}
                ）・差し戻し {formatYen(r.transfer_reversal_amount)}
              </p>
              <p className="text-red-700">{r.failure_reason}</p>
              <p className="text-xs text-zinc-500">
                {dt(r.created_at)}・試行 {r.attempts}回
              </p>
            </div>
            <ActionForm
              action={retryRefundAction}
              hidden={{ refundId: r.id }}
              label="再実行する"
              withReason={false}
            />
          </Card>
        );
      })}
    </div>
  );
}
