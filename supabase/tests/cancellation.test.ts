import { describe, expect, it } from "vitest";
import {
  calcBookingFees,
  calcRefund,
  decideCancellation,
  type CancelActor,
  type CancelPolicy,
} from "@thippo/core";
import { as, asSuperuser, expectError, serviceRole, uid } from "./helpers/db";
import { createHostWithSpace, createUser } from "./helpers/fixtures";

describe("DB 側の判定は packages/core と一致する", () => {
  it("decide_cancel_policy", async () => {
    const start = new Date("2026-12-01T10:00:00+09:00");
    const offsetsMin = [-600, -121, -120, -119, -60, -1, 0, 1, 60];
    const cases: [CancelActor, number, number][] = [];
    for (const actor of ["guest", "host", "admin"] as const)
      for (const off of offsetsMin)
        for (const count of [0, 4, 5, 6]) cases.push([actor, off, count]);
    await asSuperuser(async (db) => {
      for (const [actor, off, count] of cases) {
        const now = new Date(start.getTime() + off * 60_000);
        const { rows } = await db.query(
          "select private.decide_cancel_policy($1, $2, $3, $4) as p",
          [actor, now, start, count],
        );
        expect([actor, off, count, rows[0].p]).toEqual([
          actor,
          off,
          count,
          decideCancellation({ actor, now, start, recentGuestCancelCount: count }).policy,
        ]);
      }
    });
  });

  it("calc_refund", async () => {
    await asSuperuser(async (db) => {
      for (const price of [237, 500, 1001, 1234, 9999]) {
        for (const slots of [1, 2, 3, 4, 7, 48]) {
          const f = calcBookingFees({ pricePer30min: price, slots });
          for (const policy of ["full", "half", "none"] as CancelPolicy[]) {
            const { rows } = await db.query("select (private.calc_refund($1, $2, $3, $4, $5)).*", [
              f.subtotal,
              f.applicationFee,
              f.platformFeeExclTax,
              f.hours,
              policy,
            ]);
            const r = calcRefund(f, policy);
            expect(rows[0]).toEqual({
              refund_amount: r.refundAmount,
              transfer_reversal_amount: r.transferReversalAmount,
              platform_fee_excl_tax: r.platformFeeExclTax,
              platform_fee_tax: r.platformFeeTax,
            });
          }
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------

const SLOT = 30 * 60_000;
/** now から minutes 分後以降の、最初の30分刻みの時刻 */
const alignedAfter = (minutes: number) =>
  new Date(Math.ceil((Date.now() + minutes * 60_000) / SLOT) * SLOT);

async function paidBooking(opts: { guestId?: string; startInMinutes: number; slots?: number }) {
  const h = await createHostWithSpace({ price: 1000 });
  const guestId = opts.guestId ?? (await createUser());
  const slots = opts.slots ?? 2;
  const start = alignedAfter(opts.startInMinutes);
  const end = new Date(start.getTime() + slots * SLOT);
  const f = calcBookingFees({ pricePer30min: 1000, slots });
  const orderId = uid();
  const bookingId = uid();
  await asSuperuser(async (db) => {
    await db.query(
      `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, status, paid_at, expires_at,
         stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id)
       values ($1, $2, $3, $4, $5, 'paid', now(), now(), $6, $7, $8)`,
      [
        orderId,
        guestId,
        h.hostId,
        f.subtotal,
        f.applicationFee,
        `pi_${orderId}`,
        `ch_${orderId}`,
        `tr_${orderId}`,
      ],
    );
    await db.query(
      `insert into public.bookings (id, order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status)
       values ($1, $2, $3, $4, $5, tstzrange($6, $7, '[)'), $8, 1000, $9, 'confirmed')`,
      [bookingId, orderId, h.spaceId, guestId, h.hostId, start, end, slots, f.subtotal],
    );
    await db.query(
      `insert into public.booking_fees (booking_id, hours, platform_fee_excl_tax, platform_fee_tax, stripe_fee_estimated, application_fee)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        bookingId,
        f.hours,
        f.platformFeeExclTax,
        f.platformFeeTax,
        f.stripeFeeEstimated,
        f.applicationFee,
      ],
    );
  });
  return { ...h, guestId, bookingId, orderId, fees: f };
}

const cancel = (
  bookingId: string,
  actor: CancelActor,
  actorId: string,
  reason: string | null = null,
) =>
  asSuperuser((db) =>
    db
      .query("select * from public.cancel_booking($1, $2, $3, $4)", [
        bookingId,
        actor,
        actorId,
        reason,
      ])
      .then((r) => r.rows[0]),
  );

describe("cancel_booking", () => {
  it("利用開始の2時間より前の利用者のキャンセルは全額返金。キャンセル回数に記録する", async () => {
    const b = await paidBooking({ startInMinutes: 24 * 60 });
    const r = await cancel(b.bookingId, "guest", b.guestId);
    expect(r).toMatchObject({
      policy: "full",
      refund_amount: 2000,
      transfer_reversal_amount: 2000 - b.fees.applicationFee,
      nth_cancel_in_window: 1,
      stripe_charge_id: `ch_${b.orderId}`,
      stripe_transfer_id: `tr_${b.orderId}`,
    });
    const { rows } = await asSuperuser((db) =>
      db.query(
        `select b.status, b.cancelled_by, b.cancel_policy, r.status as refund_status,
                (select count(*)::int from public.cancel_events e where e.booking_id = b.id) as events
         from public.bookings b join public.refunds r on r.booking_id = b.id where b.id = $1`,
        [b.bookingId],
      ),
    );
    expect(rows[0]).toEqual({
      status: "cancelled",
      cancelled_by: "guest",
      cancel_policy: "full",
      refund_status: "pending",
      events: 1,
    });
  });

  it("利用開始の2時間以内は半額返金。差し戻しは 返金額 − 110 × hours", async () => {
    const b = await paidBooking({ startInMinutes: 60 });
    const r = await cancel(b.bookingId, "guest", b.guestId);
    expect(r).toMatchObject({
      policy: "half",
      refund_amount: 1000,
      transfer_reversal_amount: 1000 - 110,
    });
  });

  it("過去24時間に5回キャンセルしていたら、6回目は返金なし（Stripe の処理なしで返金は完了扱い）", async () => {
    const guestId = await createUser();
    for (let i = 0; i < 5; i++) {
      const b = await paidBooking({ guestId, startInMinutes: 24 * 60 });
      expect((await cancel(b.bookingId, "guest", guestId)).policy).toBe("full");
    }
    const sixth = await paidBooking({ guestId, startInMinutes: 24 * 60 });
    const r = await cancel(sixth.bookingId, "guest", guestId);
    expect(r).toMatchObject({
      policy: "none",
      refund_amount: 0,
      transfer_reversal_amount: 0,
      nth_cancel_in_window: 6,
    });
    const { rows } = await asSuperuser((db) =>
      db.query("select status from public.refunds where booking_id = $1", [sixth.bookingId]),
    );
    expect(rows[0].status).toBe("succeeded");
  });

  it("同時にキャンセルしても回数の判定が崩れない（advisory lock）", async () => {
    const guestId = await createUser();
    for (let i = 0; i < 4; i++) {
      const b = await paidBooking({ guestId, startInMinutes: 24 * 60 });
      await cancel(b.bookingId, "guest", guestId);
    }
    const bookings = await Promise.all(
      [0, 1, 2].map(() => paidBooking({ guestId, startInMinutes: 24 * 60 })),
    );
    const results = await Promise.all(bookings.map((b) => cancel(b.bookingId, "guest", guestId)));
    // 5回目だけが返金あり、6回目・7回目は返金なし
    expect(results.map((r) => r.nth_cancel_in_window).sort()).toEqual([5, 6, 7]);
    expect(results.filter((r) => r.policy === "full")).toHaveLength(1);
    expect(results.filter((r) => r.policy === "none")).toHaveLength(2);
  });

  it("貸出主・運営のキャンセルは常に全額返金。理由が必要で、回数に数えず、操作ログに残る", async () => {
    const b = await paidBooking({ startInMinutes: 30 });
    await asSuperuser(async (db) => {
      await expect(
        db.query("select * from public.cancel_booking($1, 'host', $2, ' ')", [
          b.bookingId,
          b.memberId,
        ]),
      ).rejects.toThrow(/reason_required/);
    });
    const r = await cancel(b.bookingId, "host", b.memberId, "設備の故障のため");
    expect(r).toMatchObject({ policy: "full", refund_amount: 2000, nth_cancel_in_window: null });
    const { rows } = await asSuperuser((db) =>
      db.query(
        `select (select count(*)::int from public.cancel_events where booking_id = $1) as events,
                (select action from public.audit_logs where target_id = $1::text) as action`,
        [b.bookingId],
      ),
    );
    expect(rows[0]).toEqual({ events: 0, action: "host.booking_cancel" });

    const adminId = await createUser("admin");
    const c = await paidBooking({ startInMinutes: 24 * 60 });
    expect((await cancel(c.bookingId, "admin", adminId, "運営判断")).policy).toBe("full");
  });

  it("他人の予約・他社の予約はキャンセルできない。キャンセル済みは二重にキャンセルできない", async () => {
    const b = await paidBooking({ startInMinutes: 24 * 60 });
    const stranger = await createUser();
    const otherHost = await createHostWithSpace();
    await asSuperuser(async (db) => {
      await expect(
        db.query("select * from public.cancel_booking($1, 'guest', $2)", [b.bookingId, stranger]),
      ).rejects.toThrow(/not_allowed/);
      await expect(
        db.query("select * from public.cancel_booking($1, 'host', $2, 'x')", [
          b.bookingId,
          otherHost.memberId,
        ]),
      ).rejects.toThrow(/not_allowed/);
      // 利用者のアカウントで admin を名乗っても拒否
      await expect(
        db.query("select * from public.cancel_booking($1, 'admin', $2, 'x')", [
          b.bookingId,
          stranger,
        ]),
      ).rejects.toThrow(/not_allowed/);
    });
    await cancel(b.bookingId, "guest", b.guestId);
    await asSuperuser(async (db) => {
      await expect(
        db.query("select * from public.cancel_booking($1, 'guest', $2)", [b.bookingId, b.guestId]),
      ).rejects.toThrow(/booking_not_cancellable/);
    });
  });

  it("キャンセルすると枠が空く", async () => {
    const b = await paidBooking({ startInMinutes: 24 * 60 });
    await cancel(b.bookingId, "guest", b.guestId);
    const { rows } = await asSuperuser((db) =>
      db.query(
        "select count(*)::int as n from public.space_busy_periods($1, now(), now() + interval '3 days')",
        [b.spaceId],
      ),
    );
    expect(rows[0].n).toBe(0);
  });

  it("ブラウザからは呼べない", async () => {
    const b = await paidBooking({ startInMinutes: 24 * 60 });
    const { user } = await import("./helpers/db");
    await as(user(b.guestId), async (db) => {
      await expectError(db, "select * from public.cancel_booking($1, 'guest', $2)", [
        b.bookingId,
        b.guestId,
      ]);
    });
  });
});

describe("返金の記録", () => {
  it("返金と差し戻しの両方が済むまで succeeded にしない。成功は一度だけ", async () => {
    const b = await paidBooking({ startInMinutes: 24 * 60 });
    const r = await cancel(b.bookingId, "guest", b.guestId);
    await as(serviceRole, async (db) => {
      await db.query("select public.record_refund_progress($1, 're_1', null)", [r.refund_id]);
      const early = await db.query("select public.mark_refund_succeeded($1, 're_1') as ok", [
        r.refund_id,
      ]);
      expect(early.rows[0].ok).toBe(false);
      await db.query("select public.record_refund_progress($1, null, 'trr_1')", [r.refund_id]);
      const ok = await db.query("select public.mark_refund_succeeded($1, 're_1') as ok", [
        r.refund_id,
      ]);
      expect(ok.rows[0].ok).toBe(true);
      const again = await db.query("select public.mark_refund_succeeded($1, 're_1') as ok", [
        r.refund_id,
      ]);
      expect(again.rows[0].ok).toBe(false);
    });
  });

  it("失敗は failed として記録し、やり直すと pending に戻る", async () => {
    const b = await paidBooking({ startInMinutes: 24 * 60 });
    const r = await cancel(b.bookingId, "guest", b.guestId);
    await as(serviceRole, async (db) => {
      await db.query("select public.record_refund_progress($1, null, null, 'card_declined')", [
        r.refund_id,
      ]);
      let row = await db.query(
        "select status, failure_reason, attempts from public.refunds where id = $1",
        [r.refund_id],
      );
      expect(row.rows[0]).toEqual({
        status: "failed",
        failure_reason: "card_declined",
        attempts: 1,
      });
      await db.query("select public.record_refund_progress($1, 're_2', 'trr_2')", [r.refund_id]);
      row = await db.query("select status, attempts from public.refunds where id = $1", [
        r.refund_id,
      ]);
      expect(row.rows[0]).toEqual({ status: "pending", attempts: 2 });
    });
  });
});
