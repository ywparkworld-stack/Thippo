import { cronRoute } from "../../../lib/cron";
import { dailyCleanup } from "../../../lib/jobs";

/** 毎日の片付け（レート制限・不要なファイル・保存期間を過ぎた書類） */
export const GET = cronRoute("cleanup", () => dailyCleanup());

// PDF の作成やメールの送信に時間がかかる場合がある
export const maxDuration = 300;
