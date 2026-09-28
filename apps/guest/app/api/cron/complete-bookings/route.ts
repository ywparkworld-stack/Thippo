import { cronRoute } from "../../../lib/cron";
import { completeFinishedBookings } from "../../../lib/jobs";

/** 利用終了時刻を過ぎた予約を completed にする（15分ごと） */
export const GET = cronRoute("complete-bookings", () => completeFinishedBookings());

// PDF の作成やメールの送信に時間がかかる場合がある
export const maxDuration = 300;
