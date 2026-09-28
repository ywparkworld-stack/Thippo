import { formatTokyoDateTime, minutesToTime, toTokyoDate, toTokyoMinutes } from "@thippo/core";

export const BOOKING_STATUS_LABELS = {
  pending: "お支払い待ち",
  expired: "期限切れ",
  confirmed: "予約確定",
  cancelled: "キャンセル済み",
  completed: "利用済み",
  no_show: "無断キャンセル",
} as const;
export const ORDER_STATUS_LABELS = {
  pending: "支払い待ち",
  paid: "支払い済み",
  expired: "期限切れ",
  failed: "失敗",
} as const;
export const REFUND_STATUS_LABELS = {
  pending: "処理中",
  succeeded: "完了",
  failed: "失敗",
} as const;
export const CANCELLED_BY_LABELS = { guest: "利用者", host: "貸出主都合", admin: "運営" } as const;
export const ROLE_LABELS = { guest: "利用者", host: "貸出主", admin: "運営" } as const;

export const dt = (iso: string | null | undefined) =>
  iso ? formatTokyoDateTime(new Date(iso)) : "—";
export const periodLabel = (start: string, end: string) =>
  `${formatTokyoDateTime(new Date(start))}〜${minutesToTime(toTokyoMinutes(new Date(end)))}`;

export function currentMonth(now = new Date()): string {
  return toTokyoDate(now).slice(0, 7);
}
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}
export function parseMonth(value: unknown): string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : currentMonth();
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Stripe のダッシュボードの決済画面（テストモードのキーならテストの画面） */
export function stripePaymentUrl(paymentIntentId: string): string {
  const test = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test") ? "test/" : "";
  return `https://dashboard.stripe.com/${test}payments/${paymentIntentId}`;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** 今から days 日前の ISO 文字列（サーバーでの描画時に使う） */
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
