import { cronRoute } from "../../../lib/cron";
import { syncStripeFees } from "../../../lib/jobs";

/** 実際の Stripe 手数料を取得して保存する（毎時） */
export const GET = cronRoute("stripe-fees", () => syncStripeFees());

// PDF の作成やメールの送信に時間がかかる場合がある
export const maxDuration = 300;
