import { expireDueOrders } from "@thippo/payments/checkout";
import { cronRoute } from "../../../lib/cron";

/** 15分以上 pending の注文を expired にして枠を解放し、PaymentIntent を取り消す（SPEC §7-4・§11。5分ごと） */
export const GET = cronRoute("expire-orders", async () => ({ ...(await expireDueOrders()) }));
