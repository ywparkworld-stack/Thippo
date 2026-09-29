import { cronRoute } from "../../../lib/cron";
import { syncStripeFees } from "../../../lib/jobs";

/** 実際の Stripe 手数料を取得して保存する（毎時） */
export const GET = cronRoute("stripe-fees", () => syncStripeFees());

// PDF の作成やメールの送信に時間がかかる場合がある
// Vercel の Hobby プランの上限（60秒）に合わせる。途中で終わっても、次の実行で続きを処理する（どれも2回実行してよい）
export const maxDuration = 60;
