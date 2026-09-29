import { cronRoute } from "../../../lib/cron";
import { sendDayBeforeReminders } from "../../../lib/jobs";

/** 利用前日のリマインド（毎日18:00 JST） */
export const GET = cronRoute("reminders-day-before", () => sendDayBeforeReminders());

// PDF の作成やメールの送信に時間がかかる場合がある
// Vercel の Hobby プランの上限（60秒）に合わせる。途中で終わっても、次の実行で続きを処理する（どれも2回実行してよい）
export const maxDuration = 60;
