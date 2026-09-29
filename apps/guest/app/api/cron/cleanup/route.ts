import { cronRoute } from "../../../lib/cron";
import { dailyCleanup } from "../../../lib/jobs";

/** 毎日の片付け（レート制限・不要なファイル・保存期間を過ぎた書類） */
export const GET = cronRoute("cleanup", () => dailyCleanup());

// PDF の作成やメールの送信に時間がかかる場合がある
// Vercel の Hobby プランの上限（60秒）に合わせる。途中で終わっても、次の実行で続きを処理する（どれも2回実行してよい）
export const maxDuration = 60;
