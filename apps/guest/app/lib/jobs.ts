import "server-only";
import { IDENTITY, addDays, toTokyoDate } from "@thippo/core";
import { createSupabaseServiceClient } from "@thippo/db/admin";
import { issueMonthlyStatement } from "@thippo/invoice/statements";
import { sendBookingReminderEmail, sendStatementIssuedEmails } from "@thippo/mail/booking-emails";
import { stripe } from "@thippo/payments/server";

/** 利用終了時刻を過ぎた予約を completed にする（SPEC §7-9。15分ごと） */
export async function completeFinishedBookings() {
  const { data, error } = await createSupabaseServiceClient().rpc("complete_finished_bookings");
  if (error) throw new Error(error.message);
  return { completed: data ?? 0 };
}

/** 利用前日のリマインド（毎日18:00 JST。翌日の予約。付録 D31） */
export async function sendDayBeforeReminders(now = new Date()) {
  const tomorrow = addDays(toTokyoDate(now), 1);
  const { data, error } = await createSupabaseServiceClient().rpc("claim_day_before_reminders", {
    p_date: tomorrow,
  });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) await sendBookingReminderEmail(row.booking_id, "day_before");
  return { date: tomorrow, sent: data?.length ?? 0 };
}

/** 利用開始2時間前のリマインド（15分ごと。付録 D31） */
export async function sendTwoHourReminders() {
  const { data, error } = await createSupabaseServiceClient().rpc("claim_two_hour_reminders", {});
  if (error) throw new Error(error.message);
  for (const row of data ?? []) await sendBookingReminderEmail(row.booking_id, "two_hours");
  return { sent: data?.length ?? 0 };
}

/** 前月分の月次明細と請求書 PDF を作り、貸出主に通知する（毎月1日。SPEC §11） */
export async function issuePreviousMonthStatements(now = new Date()) {
  const [y, m] = toTokyoDate(now).split("-").map(Number) as [number, number];
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const month = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const service = createSupabaseServiceClient();
  const { data: hosts } = await service.from("hosts").select("id").is("deleted_at", null);
  let issued = 0;
  const failures: string[] = [];
  for (const h of hosts ?? []) {
    const { data: lines } = await service.rpc("host_statement_lines", {
      p_host_id: h.id,
      p_month: `${month}-01`,
    });
    if (!lines || lines.length === 0) continue;
    try {
      await issueMonthlyStatement(h.id, month);
      const { data: s } = await service.rpc("host_statement_summary", {
        p_host_id: h.id,
        p_month: `${month}-01`,
      });
      await sendStatementIssuedEmails(h.id, month, s?.[0]?.net ?? 0);
      await service.from("audit_logs").insert({
        actor_id: null,
        action: "system.statement_issue",
        target_table: "hosts",
        target_id: h.id,
        payload: { month },
      });
      issued++;
    } catch (e) {
      if ((e as Error).message !== "already_issued")
        failures.push(`${h.id}: ${(e as Error).message}`);
    }
  }
  if (failures.length > 0) throw new Error(`issued ${issued}, failed: ${failures.join("; ")}`);
  return { month, issued };
}

/**
 * 実際の Stripe 手数料を balance_transaction から取得して保存する（SPEC §5・§11。毎時）。
 * Destination charges の決済手数料はプラットフォームの残高から引かれる（fee_details の stripe_fee）。
 */
export async function syncStripeFees(limit = 100) {
  const service = createSupabaseServiceClient();
  const { data: orders } = await service
    .from("orders")
    .select("id, stripe_charge_id")
    .eq("status", "paid")
    .is("stripe_fee_actual", null)
    .not("stripe_charge_id", "is", null)
    .order("paid_at")
    .limit(limit);
  let updated = 0;
  for (const o of orders ?? []) {
    const charge = await stripe().charges.retrieve(o.stripe_charge_id!, {
      expand: ["balance_transaction"],
    });
    const bt = charge.balance_transaction;
    if (!bt || typeof bt === "string") continue; // まだ確定していない
    const fee = bt.fee_details
      .filter((f) => f.type === "stripe_fee")
      .reduce((sum, f) => sum + f.amount, 0);
    await service.rpc("set_order_stripe_fee_actual", { p_order_id: o.id, p_fee: fee });
    updated++;
  }
  return { updated };
}

/** 毎日の片付け：レート制限のカウンター、提出されなかった本人確認のファイル、保存期間を過ぎた書類（D33） */
export async function dailyCleanup() {
  const service = createSupabaseServiceClient();
  const { data: purgedCounters } = await service.rpc("purge_rate_limit_counters");

  const { data: orphans } = await service.rpc("orphan_identity_files", {});
  const orphanNames = (orphans ?? []).map((o) => o.name);
  if (orphanNames.length > 0) await service.storage.from("identity-documents").remove(orphanNames);

  // TODO(要確認): 保存期間（SPEC §16）が決まるまでは削除しない
  let purgedDocuments = 0;
  const retention = IDENTITY.documentRetentionDaysAfterWithdrawal;
  if (retention !== null) {
    const { data: due } = await service.rpc("identity_documents_due_for_purge", {
      p_retention_days: retention,
    });
    const paths = (due ?? [])
      .flatMap((d) => [d.front_path, d.back_path])
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      const { error } = await service.storage.from("identity-documents").remove(paths);
      if (error) throw new Error(`failed to purge identity documents: ${error.message}`);
      await service.rpc("mark_identity_documents_purged", {
        p_document_ids: (due ?? []).map((d) => d.document_id),
      });
      purgedDocuments = due?.length ?? 0;
    }
  }
  return {
    purgedCounters: purgedCounters ?? 0,
    orphanFiles: orphanNames.length,
    purgedDocuments,
    retentionConfigured: retention !== null,
  };
}
