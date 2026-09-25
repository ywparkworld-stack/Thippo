import { SLOT_MINUTES, TOKYO_UTC_OFFSET_MINUTES } from "./config";

/**
 * Asia/Tokyo の日付・時刻の扱い。夏時間がないので固定オフセット（+09:00）で変換する。
 * 日付は "YYYY-MM-DD"、時刻は "HH:MM" または "HH:MM:SS"（"24:00" も可）で表す。
 */

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const OFFSET_MS = TOKYO_UTC_OFFSET_MINUTES * MINUTE_MS;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseDate(date: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new RangeError(`invalid date: ${date}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new RangeError(`invalid date: ${date}`);
  }
  return { y, m, d };
}

/** "HH:MM[:SS]" を 0 時からの分に変換する。秒は 0 のみ許可。"24:00" は 1440。 */
export function timeToMinutes(time: string): number {
  const match = TIME_RE.exec(time);
  if (!match) throw new RangeError(`invalid time: ${time}`);
  const h = Number(match[1]);
  const min = Number(match[2]);
  const sec = match[3] === undefined ? 0 : Number(match[3]);
  if (sec !== 0 || min > 59 || h > 24 || (h === 24 && min !== 0)) {
    throw new RangeError(`invalid time: ${time}`);
  }
  return h * 60 + min;
}

export function minutesToTime(minutes: number): string {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > DAY_MINUTES) {
    throw new RangeError(`invalid minutes: ${minutes}`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 東京の日付 + 0時からの分 → UTC の Date。 */
export function tokyoToUtc(date: string, minutesFromMidnight: number): Date {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d) + minutesFromMidnight * MINUTE_MS - OFFSET_MS);
}

/** Date → 東京の日付 "YYYY-MM-DD"。 */
export function toTokyoDate(instant: Date): string {
  const t = new Date(instant.getTime() + OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Date → 東京の 0 時からの分。 */
export function toTokyoMinutes(instant: Date): number {
  const t = new Date(instant.getTime() + OFFSET_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** 東京の日付の曜日。0 = 日曜 … 6 = 土曜（PostgreSQL の extract(dow) と同じ）。 */
export function tokyoWeekday(date: string): number {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** 30 分刻みの時刻か（東京のオフセットは 30 分の倍数なので UTC で判定してよい）。 */
export function isSlotAligned(instant: Date): boolean {
  return instant.getTime() % (SLOT_MINUTES * MINUTE_MS) === 0;
}

/** 表示用の書式: 2026/09/25(金) 13:30 */
export function formatTokyoDateTime(instant: Date): string {
  const date = toTokyoDate(instant);
  const [y, m, d] = date.split("-");
  const wd = "日月火水木金土"[tokyoWeekday(date)];
  return `${y}/${m}/${d}(${wd}) ${minutesToTime(toTokyoMinutes(instant))}`;
}
