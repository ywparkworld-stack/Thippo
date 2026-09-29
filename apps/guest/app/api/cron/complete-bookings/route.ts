import { cronRoute } from "../../../lib/cron";
import { completeFinishedBookings } from "../../../lib/jobs";

/** 利用終了時刻を過ぎた予約を completed にする（15分ごと） */
export const GET = cronRoute("complete-bookings", () => completeFinishedBookings());

// PDF の作成やメールの送信に時間がかかる場合がある
// Vercel の Hobby プランの上限（60秒）に合わせる。途中で終わっても、次の実行で続きを処理する（どれも2回実行してよい）
export const maxDuration = 60;
