import { cronRoute } from "../../../lib/cron";
import { issuePreviousMonthStatements } from "../../../lib/jobs";

/** 前月分の月次明細と請求書を発行して通知する（毎月1日） */
export const GET = cronRoute("monthly-statements", () => issuePreviousMonthStatements());

// PDF の作成やメールの送信に時間がかかる場合がある
// Vercel の Hobby プランの上限（60秒）に合わせる。途中で終わっても、次の実行で続きを処理する（どれも2回実行してよい）
export const maxDuration = 60;
