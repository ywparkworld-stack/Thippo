import Stripe from "stripe";
import { beforeAll, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@thippo/db/admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));

const secret = "whsec_test";
const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "account.updated",
  data: { object: {} },
});
let header: string;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  header = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
});

describe("handleStripeWebhook", () => {
  it("署名が正しくなければ 400 で、何も記録しない", async () => {
    const { handleStripeWebhook } = await import("../src/server");
    const handler = vi.fn();
    expect(await handleStripeWebhook(payload, "t=1,v1=bad", secret, handler)).toMatchObject({
      status: 400,
    });
    expect(await handleStripeWebhook(payload, null, secret, handler)).toMatchObject({
      status: 400,
    });
    expect(await handleStripeWebhook(payload, header, undefined, handler)).toMatchObject({
      status: 500,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("同じイベントを2回受け取っても、処理は1回だけ（2回目は duplicate）", async () => {
    const { handleStripeWebhook } = await import("../src/server");
    const handler = vi.fn(async () => undefined);
    rpc.mockReset();
    rpc
      .mockResolvedValueOnce({ data: true, error: null }) // claim（1回目）
      .mockResolvedValueOnce({ data: null, error: null }) // complete
      .mockResolvedValueOnce({ data: false, error: null }); // claim（2回目）
    expect(await handleStripeWebhook(payload, header, secret, handler)).toEqual({
      status: 200,
      body: "ok",
    });
    expect(await handleStripeWebhook(payload, header, secret, handler)).toEqual({
      status: 200,
      body: "duplicate",
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_stripe_event", { p_event_id: "evt_1" });
  });

  it("処理に失敗したら 500（Stripe が再送する）で、エラーを記録する", async () => {
    const { handleStripeWebhook } = await import("../src/server");
    rpc.mockReset();
    rpc.mockResolvedValue({ data: true, error: null });
    const r = await handleStripeWebhook(payload, header, secret, async () => {
      throw new Error("boom");
    });
    expect(r.status).toBe(500);
    expect(rpc).toHaveBeenLastCalledWith("complete_stripe_event", {
      p_event_id: "evt_1",
      p_error: "boom",
    });
  });
});
