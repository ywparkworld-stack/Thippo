import { formatTokyoDateTime, minutesToTime, toTokyoDate, toTokyoMinutes } from "@thippo/core";

export const BOOKING_STATUS_LABELS = {
  pending: "お支払い待ち",
  expired: "期限切れ",
  confirmed: "予約確定",
  cancelled: "キャンセル済み",
  completed: "利用済み",
  no_show: "無断キャンセル",
} as const;

export const CANCELLED_BY_LABELS = { guest: "利用者", host: "貸出主都合", admin: "運営" } as const;

export function periodLabel(start: string, end: string): string {
  return `${formatTokyoDateTime(new Date(start))}〜${minutesToTime(toTokyoMinutes(new Date(end)))}`;
}

/** 東京時間の今月 "YYYY-MM" */
export function currentMonth(now = new Date()): string {
  return toTokyoDate(now).slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}

export function previousMonths(count: number, now = new Date()): string[] {
  const [y, m] = currentMonth(now).split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
