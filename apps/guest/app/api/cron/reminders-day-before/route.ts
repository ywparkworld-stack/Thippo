import { cronRoute } from "../../../lib/cron";
import { sendDayBeforeReminders } from "../../../lib/jobs";

/** 利用前日のリマインド（毎日18:00 JST） */
export const GET = cronRoute("reminders-day-before", () => sendDayBeforeReminders());

// PDF の作成やメールの送信に時間がかかる場合がある
export const maxDuration = 300;
