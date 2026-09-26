import { cronRoute } from "../../../lib/cron";
import { sendTwoHourReminders } from "../../../lib/jobs";

/** 利用開始2時間前のリマインド（15分ごと） */
export const GET = cronRoute("reminders-two-hours", () => sendTwoHourReminders());

// PDF の作成やメールの送信に時間がかかる場合がある
export const maxDuration = 300;
