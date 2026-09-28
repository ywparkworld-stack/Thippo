import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const single = vi.fn();
const refundsCreate = vi.fn();
const refundsList = vi.fn();
const refundsRetrieve = vi.fn();
const createReversal = vi.fn();
const listReversals = vi.fn();

vi.mock("@thippo/db/admin", () => ({
  createSupabaseServiceClient: () => ({
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));
vi.mock("../src/server", () => ({
  idempotencyKey: (...p: (string | number)[]) => p.join(":"),
  stripe: () => ({
    refunds: { create: refundsCreate, list: refundsList, retrieve: refundsRetrieve },
    transfers: { createReversal, listReversals },
  }),
}));

const { cancelBookingAndRefund, executeRefund, processChargeRefunded } =
  await import("../src/refunds");

const refundRow = (over: Record<string, unknown> = {}) => ({
  data: {
    id: "rf_1",
    status: "pending",
    refund_amount: 1000,
    transfer_reversal_amount: 890,
    stripe_refund_id: null,
    stripe_transfer_reversal_id: null,
    attempts: 0,
    booking_id: "b_1",
    bookings: { order_id: "o_1", orders: { stripe_charge_id: "ch_1", stripe_transfer_id: "tr_1" } },
    ...over,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
  refundsList.mockResolvedValue({ data: [] });
  listReversals.mockResolvedValue({ data: [] });
  refundsCreate.mockResolvedValue({ id: "re_1" });
  createReversal.mockResolvedValue({ id: "trr_1" });
  refundsRetrieve.mockResolvedValue({ id: "re_1", status: "pending" });
});

describe("executeRefund", () => {
  it("返金額と差し戻し額を明示して、冪等キー付きで返金と差し戻しを行う（SPEC §8.1）", async () => {
    single.mockResolvedValue(refundRow());
    expect(await executeRefund("rf_1")).toEqual({ ok: true, completed: false });
    expect(refundsCreate).toHaveBeenCalledWith(
      {
        charge: "ch_1",
        amount: 1000,
        reverse_transfer: false,
        refund_application_fee: false,
        metadata: { refund_id: "rf_1", booking_id: "b_1" },
      },
      { idempotencyKey: "booking-refund:rf_1:0" },
    );
    expect(createReversal).toHaveBeenCalledWith(
      "tr_1",
      { amount: 890, metadata: { refund_id: "rf_1", booking_id: "b_1" } },
      { idempotencyKey: "booking-reversal:rf_1:0" },
    );
  });

  it("Stripe に同じ返金がすでにあれば作り直さない（記録だけ失敗していた場合）", async () => {
    single.mockResolvedValue(refundRow());
    refundsList.mockResolvedValue({
      data: [{ id: "re_old", status: "succeeded", metadata: { refund_id: "rf_1" } }],
    });
    listReversals.mockResolvedValue({ data: [{ id: "trr_old", metadata: { refund_id: "rf_1" } }] });
    refundsRetrieve.mockResolvedValue({ id: "re_old", status: "succeeded" });
    rpc.mockImplementation(async (name: string) =>
      name === "mark_refund_succeeded" ? { data: true, error: null } : { data: null, error: null },
    );
    expect(await executeRefund("rf_1")).toEqual({ ok: true, completed: true });
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(createReversal).not.toHaveBeenCalled();
  });

  it("返金済みで差し戻しだけが残っていれば、差し戻しだけを行う", async () => {
    single.mockResolvedValue(
      refundRow({ stripe_refund_id: "re_1", status: "failed", attempts: 1 }),
    );
    await executeRefund("rf_1");
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(createReversal).toHaveBeenCalledWith("tr_1", expect.anything(), {
      idempotencyKey: "booking-reversal:rf_1:1",
    });
  });

  it("差し戻し額が0円なら差し戻さない", async () => {
    single.mockResolvedValue(refundRow({ transfer_reversal_amount: 0 }));
    await executeRefund("rf_1");
    expect(createReversal).not.toHaveBeenCalled();
  });

  it("Stripe の処理が失敗したら failed として記録する（キャンセルは取り消さない）", async () => {
    single.mockResolvedValue(refundRow());
    refundsCreate.mockRejectedValue(new Error("Your card was declined"));
    expect(await executeRefund("rf_1")).toEqual({ ok: false, completed: false });
    expect(rpc).toHaveBeenLastCalledWith("record_refund_progress", {
      p_refund_id: "rf_1",
      p_stripe_refund_id: null,
      p_stripe_transfer_reversal_id: null,
      p_error: "Your card was declined",
    });
  });
});

describe("executeRefund（テスト用の支払い。付録 D37）", () => {
  it("stub の支払いは Stripe を呼ばずに返金・差し戻しを記録して完了にする", async () => {
    single.mockResolvedValue(
      refundRow({
        bookings: {
          order_id: "o_1",
          orders: { stripe_charge_id: "ch_stub_o_1", stripe_transfer_id: "tr_stub_o_1" },
        },
      }),
    );
    rpc.mockImplementation(async (name: string) =>
      name === "mark_refund_succeeded" ? { data: true, error: null } : { data: null, error: null },
    );
    expect(await executeRefund("rf_1")).toEqual({ ok: true, completed: true });
    expect(rpc).toHaveBeenCalledWith("record_refund_progress", {
      p_refund_id: "rf_1",
      p_stripe_refund_id: "re_stub_rf_1",
      p_stripe_transfer_reversal_id: "trr_stub_rf_1",
    });
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(createReversal).not.toHaveBeenCalled();
    expect(refundsRetrieve).not.toHaveBeenCalled();
  });
});

describe("cancelBookingAndRefund", () => {
  it("返金なし（0円）なら Stripe の処理を行わない", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          refund_id: "rf_1",
          policy: "none",
          refund_amount: 0,
          transfer_reversal_amount: 0,
          nth_cancel_in_window: 6,
        },
      ],
      error: null,
    });
    const r = await cancelBookingAndRefund({ bookingId: "b_1", actor: "guest", actorId: "u_1" });
    expect(r).toMatchObject({
      policy: "none",
      refundAmount: 0,
      nthCancelInWindow: 6,
      refundSubmitted: true,
    });
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(createReversal).not.toHaveBeenCalled();
  });

  it("DB 関数のエラーをコードにする", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "booking_not_cancellable" } });
    await expect(
      cancelBookingAndRefund({ bookingId: "b_1", actor: "guest", actorId: "u_1" }),
    ).rejects.toThrow("booking_not_cancellable");
  });
});

describe("processChargeRefunded", () => {
  it("thippo の返金（metadata.refund_id）で成功したものだけを完了にする", async () => {
    refundsList.mockResolvedValue({
      data: [
        { id: "re_1", status: "succeeded", metadata: { refund_id: "rf_1" } },
        { id: "re_2", status: "pending", metadata: { refund_id: "rf_2" } },
        { id: "re_3", status: "succeeded", metadata: {} },
      ],
    });
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await processChargeRefunded({ id: "ch_1" } as never)).toEqual(["rf_1"]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
