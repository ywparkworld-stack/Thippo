import { describe, expect, it } from "vitest";
import { calcBookingFees, calcRefund } from "@thippo/core";
import { anon, as, asSuperuser, expectError, serviceRole, uid, user } from "./helpers/db";
import { createHostWithSpace, createUser, type HostFixture } from "./helpers/fixtures";

const SLOT = 30 * 60_000;
let seq = 0;

async function paid(
  h: HostFixture,
  opts: { paidAt: string; startInDays?: number; slots?: number; price?: number },
) {
  const guestId = await createUser();
  const slots = opts.slots ?? 2;
  const price = opts.price ?? 1000;
  const f = calcBookingFees({ pricePer30min: price, slots });
  const start = new Date(
    Math.ceil((Date.now() + (opts.startInDays ?? 3) * 86_400_000) / SLOT) * SLOT + ++seq * SLOT * 4,
  );
  const end = new Date(start.getTime() + slots * SLOT);
  const orderId = uid();
  const bookingId = uid();
  await asSuperuser(async (db) => {
    await db.query("update public.spaces set price_per_30min = $2 where id = $1", [
      h.spaceId,
      price,
    ]);
    await db.query(
      `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, status, paid_at, expires_at,
         stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id)
       values ($1, $2, $3, $4, $5, 'paid', $6, now(), $7, $8, $9)`,
      [
        orderId,
        guestId,
        h.hostId,
        f.subtotal,
        f.applicationFee,
        opts.paidAt,
        `pi_${orderId}`,
        `ch_${orderId}`,
        `tr_${orderId}`,
      ],
    );
    await db.query(
      `insert into public.bookings (id, order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status)
       values ($1, $2, $3, $4, $5, tstzrange($6, $7, '[)'), $8, $9, $10, 'confirmed')`,
      [bookingId, orderId, h.spaceId, guestId, h.hostId, start, end, slots, price, f.subtotal],
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
  return { bookingId, guestId, fees: f };
}

const summary = (hostId: string, month: string) =>
  asSuperuser((db) =>
    db
      .query("select * from public.host_statement_summary($1, $2)", [hostId, month])
      .then((r) => r.rows[0]),
  );

describe("月次明細（決済日・キャンセル日の月で集計。D24）", () => {
  it("決済日の月に計上し、振込額 = お支払い − 運営手数料 − 決済手数料", async () => {
    const h = await createHostWithSpace();
    const a = await paid(h, { paidAt: "2026-08-31T23:59:59+09:00" });
    const b = await paid(h, { paidAt: "2026-09-01T00:00:00+09:00", slots: 3 });
    const aug = await summary(h.hostId, "2026-08-01");
    const sep = await summary(h.hostId, "2026-09-15");
    expect(aug).toEqual({
      gross: a.fees.subtotal,
      platform_fee_excl_tax: a.fees.platformFeeExclTax,
      platform_fee_tax: a.fees.platformFeeTax,
      stripe_fee: a.fees.stripeFeeEstimated,
      net: a.fees.hostPayout,
    });
    expect(sep.net).toBe(b.fees.hostPayout);
  });

  it("キャンセルはキャンセルした月に調整として計上し、手取りは core の計算と一致する", async () => {
    const h = await createHostWithSpace();
    const full = await paid(h, { paidAt: "2026-09-10T12:00:00+09:00" });
    const half = await paid(h, { paidAt: "2026-09-10T12:00:00+09:00", slots: 3, price: 1001 });
    // 10月にキャンセル（返金の行を直接作る）
    await asSuperuser(async (db) => {
      for (const [b, policy] of [
        [full, "full"],
        [half, "half"],
      ] as const) {
        const r = calcRefund(b.fees, policy);
        await db.query(
          `update public.bookings set status = 'cancelled', cancelled_by = 'guest', cancelled_at = '2026-10-05T10:00+09:00', cancel_policy = $2 where id = $1`,
          [b.bookingId, policy],
        );
        await db.query(
          `insert into public.refunds (booking_id, policy, refund_amount, transfer_reversal_amount, platform_fee_excl_tax, platform_fee_tax, created_at)
           values ($1, $2, $3, $4, $5, $6, '2026-10-05T10:00+09:00')`,
          [
            b.bookingId,
            policy,
            r.refundAmount,
            r.transferReversalAmount,
            r.platformFeeExclTax,
            r.platformFeeTax,
          ],
        );
      }
    });
    const sep = await summary(h.hostId, "2026-09-01");
    const oct = await summary(h.hostId, "2026-10-01");
    expect(sep.net).toBe(full.fees.hostPayout + half.fees.hostPayout);
    // 9月と10月を合わせた手取り = キャンセル後の手取り（core）
    expect(sep.net + oct.net).toBe(
      calcRefund(full.fees, "full").hostNet + calcRefund(half.fees, "half").hostNet,
    );
    expect(sep.gross + oct.gross).toBe(
      full.fees.subtotal -
        full.fees.subtotal +
        half.fees.subtotal -
        Math.floor(half.fees.subtotal / 2),
    );
    const { rows } = await asSuperuser((db) =>
      db.query("select kind from public.host_statement_lines($1, '2026-10-01')", [h.hostId]),
    );
    expect(rows.map((r) => r.kind)).toEqual(["cancellation", "cancellation"]);
  });

  it("他社の明細は読めない", async () => {
    const h = await createHostWithSpace();
    const other = await createHostWithSpace();
    const guest = await createUser();
    for (const actor of [user(other.memberId), user(guest), anon]) {
      await as(actor, async (db) => {
        await expectError(db, "select * from public.host_statement_lines($1, '2026-09-01')", [
          h.hostId,
        ]);
      });
    }
    await as(user(h.memberId), async (db) => {
      await db.query("select * from public.host_statement_lines($1, '2026-09-01')", [h.hostId]);
    });
  });

  it("発行は1か月に1回。発行後は作り直せない", async () => {
    const h = await createHostWithSpace();
    await paid(h, { paidAt: "2026-09-10T12:00:00+09:00" });
    await as(serviceRole, async (db) => {
      await db.query("select public.issue_monthly_statement($1, '2026-09-01', 'x.pdf', 'S-1')", [
        h.hostId,
      ]);
      expect(
        await expectError(
          db,
          "select public.issue_monthly_statement($1, '2026-09-20', 'y.pdf', 'S-2')",
          [h.hostId],
        ),
      ).toMatch(/already_issued/);
    });
  });
});

describe("host_bookings・record_no_show", () => {
  it("自社の予約だけを、利用者の表示名つきで返す", async () => {
    const h = await createHostWithSpace();
    const other = await createHostWithSpace();
    const mine = await paid(h, { paidAt: "2026-09-10T12:00:00+09:00" });
    await paid(other, { paidAt: "2026-09-10T12:00:00+09:00" });
    await as(user(h.memberId), async (db) => {
      const { rows } = await db.query(
        "select booking_id, guest_name, application_fee from public.host_bookings()",
      );
      expect(rows.map((r) => r.booking_id)).toEqual([mine.bookingId]);
      expect(rows[0].application_fee).toBe(mine.fees.applicationFee);
    });
    await as(user(mine.guestId), async (db) => {
      const { rows } = await db.query("select * from public.host_bookings()");
      expect(rows).toHaveLength(0);
    });
  });

  it("無断キャンセルは利用開始後だけ記録できる", async () => {
    const h = await createHostWithSpace();
    const future = await paid(h, { paidAt: "2026-09-10T12:00:00+09:00" });
    await as(user(h.memberId), async (db) => {
      expect(await expectError(db, "select public.record_no_show($1)", [future.bookingId])).toMatch(
        /booking_not_started/,
      );
    });
    await asSuperuser((db) =>
      db.query(
        "update public.bookings set period = tstzrange(now() - interval '2 hours' - (extract(epoch from now())::int % 1800) * interval '1 second', now() - interval '1 hour' - (extract(epoch from now())::int % 1800) * interval '1 second', '[)') where id = $1",
        [future.bookingId],
      ),
    );
    const other = await createHostWithSpace();
    await as(user(other.memberId), async (db) => {
      expect(await expectError(db, "select public.record_no_show($1)", [future.bookingId])).toMatch(
        /not_allowed/,
      );
    });
    await as(user(h.memberId), async (db) => {
      await db.query("select public.record_no_show($1)", [future.bookingId]);
      const { rows } = await db.query("select status from public.bookings where id = $1", [
        future.bookingId,
      ]);
      expect(rows[0].status).toBe("no_show");
    });
  });
});

describe("担当者", () => {
  it("同じ貸出主の担当者の一覧を読める。担当者は招待したばかりのアカウントだけ追加できる", async () => {
    const h = await createHostWithSpace();
    const invited = uid();
    await asSuperuser((db) =>
      db.query("insert into auth.users (id, email) values ($1, $2)", [
        invited,
        `${invited}@example.test`,
      ]),
    );
    await asSuperuser((db) =>
      db.query("select public.add_host_member($1, $2, $3)", [h.hostId, h.memberId, invited]),
    );
    await as(user(h.memberId), async (db) => {
      const { rows } = await db.query("select user_id from public.host_member_list()");
      expect(rows.map((r) => r.user_id).sort()).toEqual([h.memberId, invited].sort());
    });
    const guest = await createUser();
    await asSuperuser(async (db) => {
      await db.query("update public.profiles set identity_status = 'approved' where id = $1", [
        guest,
      ]);
      await expect(
        db.query("select public.add_host_member($1, $2, $3)", [h.hostId, h.memberId, guest]),
      ).rejects.toThrow(/email_already_registered/);
      const other = await createHostWithSpace();
      const x = uid();
      await db.query("insert into auth.users (id, email) values ($1, $2)", [
        x,
        `${x}@example.test`,
      ]);
      await expect(
        db.query("select public.add_host_member($1, $2, $3)", [h.hostId, other.memberId, x]),
      ).rejects.toThrow(/not_allowed/);
    });
  });
});
