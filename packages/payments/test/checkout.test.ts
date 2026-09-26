import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const refundsCreate = vi.fn();
const chargesRetrieve = vi.fn();
const piRetrieve = vi.fn();
const piCancel = vi.fn();
const piCreate = vi.fn();

vi.mock("@thippo/db/admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
vi.mock("../src/server", () => ({
  idempotencyKey: (...p: string[]) => p.join(":"),
  stripe: () => ({
    refunds: { create: refundsCreate },
    charges: { retrieve: chargesRetrieve },
    paymentIntents: { retrieve: piRetrieve, cancel: piCancel, create: piCreate },
  }),
}));

const { processSucceededPaymentIntent, cancelPaymentIntent, createOrderAndPaymentIntent } =
  await import("../src/checkout");

const pi = (over: Partial<Stripe.PaymentIntent> = {}) =>
  ({
    id: "pi_1",
    status: "succeeded",
    amount_received: 3000,
    latest_charge: "ch_1",
    metadata: { order_id: "order-1" },
    ...over,
  }) as Stripe.PaymentIntent;

beforeEach(() => {
  vi.resetAllMocks();
  chargesRetrieve.mockResolvedValue({ id: "ch_1", transfer: "tr_1" });
});

describe("processSucceededPaymentIntent", () => {
  it("注文を paid にし、charge と transfer を保存する", async () => {
    rpc.mockResolvedValueOnce({ data: "paid", error: null });
    expect(await processSucceededPaymentIntent(pi())).toEqual({ kind: "paid", orderId: "order-1" });
    expect(rpc).toHaveBeenCalledWith("mark_order_paid", {
      p_order_id: "order-1",
      p_payment_intent_id: "pi_1",
      p_amount: 3000,
      p_charge_id: "ch_1",
      p_transfer_id: "tr_1",
    });
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("期限切れのあとの支払いは、冪等キー付きで全額返金する（D8）", async () => {
    rpc
      .mockResolvedValueOnce({ data: "late", error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    refundsCreate.mockResolvedValue({ id: "re_1" });
    expect(await processSucceededPaymentIntent(pi())).toEqual({
      kind: "late_refunded",
      orderId: "order-1",
    });
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_1",
        reverse_transfer: true,
        refund_application_fee: true,
      }),
      { idempotencyKey: "late-payment-refund:pi_1" },
    );
    expect(rpc).toHaveBeenLastCalledWith("record_late_payment_refund", {
      p_order_id: "order-1",
      p_refund_id: "re_1",
    });
  });

  it("thippo の注文でない PaymentIntent は無視する", async () => {
    expect(await processSucceededPaymentIntent(pi({ metadata: {} }))).toEqual({ kind: "ignored" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("cancelPaymentIntent", () => {
  it("成功済み・処理中は取り消さない", async () => {
    piRetrieve
      .mockResolvedValueOnce({ status: "succeeded" })
      .mockResolvedValueOnce({ status: "processing" });
    expect(await cancelPaymentIntent("pi_1")).toBe(false);
    expect(await cancelPaymentIntent("pi_1")).toBe(false);
    expect(piCancel).not.toHaveBeenCalled();
  });

  it("未払いなら冪等キー付きで取り消す", async () => {
    piRetrieve.mockResolvedValueOnce({ status: "requires_payment_method" });
    expect(await cancelPaymentIntent("pi_1")).toBe(true);
    expect(piCancel).toHaveBeenCalledWith(
      "pi_1",
      { cancellation_reason: "abandoned" },
      { idempotencyKey: "pi-cancel:pi_1" },
    );
  });
});

describe("createOrderAndPaymentIntent", () => {
  it("Destination charges で、カードのみ・application fee・送金先・注文 id を付けて作る", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          order_id: "o1",
          order_number: "T-00000001",
          total: 3000,
          application_fee_amount: 548,
          host_stripe_account_id: "acct_1",
        },
      ],
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    piCreate.mockResolvedValue({ id: "pi_1", client_secret: "secret" });
    const r = await createOrderAndPaymentIntent("guest-1");
    expect(r).toEqual({
      orderId: "o1",
      orderNumber: "T-00000001",
      total: 3000,
      clientSecret: "secret",
    });
    expect(piCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000,
        currency: "jpy",
        payment_method_types: ["card"],
        application_fee_amount: 548,
        transfer_data: { destination: "acct_1" },
        metadata: expect.objectContaining({ order_id: "o1" }),
      }),
      { idempotencyKey: "order-payment-intent:o1" },
    );
  });

  it("DB 関数のエラー（他の方が先に予約）をコードにして返す", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "slot_taken" } });
    await expect(createOrderAndPaymentIntent("guest-1")).rejects.toThrow("slot_taken");
    expect(piCreate).not.toHaveBeenCalled();
  });

  it("PaymentIntent を作れなければ注文を閉じて枠を解放する", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          order_id: "o1",
          order_number: "T-1",
          total: 3000,
          application_fee_amount: 548,
          host_stripe_account_id: "acct_1",
        },
      ],
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    piCreate.mockRejectedValue(new Error("stripe down"));
    await expect(createOrderAndPaymentIntent("guest-1")).rejects.toThrow("stripe down");
    expect(rpc).toHaveBeenLastCalledWith("close_pending_order", {
      p_order_id: "o1",
      p_status: "failed",
    });
  });
});
