import { cronRoute } from "../../../lib/cron";
import { issuePreviousMonthStatements } from "../../../lib/jobs";

/** 前月分の月次明細と請求書を発行して通知する（毎月1日） */
export const GET = cronRoute("monthly-statements", () => issuePreviousMonthStatements());

// PDF の作成やメールの送信に時間がかかる場合がある
export const maxDuration = 300;
