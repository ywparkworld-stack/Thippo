import { beforeEach, describe, expect, it } from "vitest";
import {
  addDays,
  calcBookingFees,
  toTokyoDate,
  tokyoToUtc,
  validateBookingPeriod,
} from "@thippo/core";
import { anon, as, asSuperuser, expectError, serviceRole, uid, user, type Db } from "./helpers/db";
import { createHostWithSpace, createUser, type HostFixture } from "./helpers/fixtures";

// 明日（東京時間）の hh:mm〜
const tomorrow = () => addDays(toTokyoDate(new Date()), 1);
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return tokyoToUtc(date, h! * 60 + m!).toISOString();
};
const range = (date: string, from: string, to: string) => `[${at(date, from)},${at(date, to)})`;

let host: HostFixture;
let guest: string;

async function approvedGuest(): Promise<string> {
  const id = await createUser("guest");
  await asSuperuser((db) =>
    db.query("update public.profiles set identity_status = 'approved' where id = $1", [id]),
  );
  return id;
}

async function openAllDay(spaceId: string) {
  await asSuperuser(async (db) => {
    for (let wd = 0; wd < 7; wd++) {
      await db.query(
        "insert into public.availability_rules (space_id, weekday, open_time, close_time) values ($1, $2, '09:00', '18:00')",
        [spaceId, wd],
      );
    }
  });
}

async function addToCart(guestId: string, spaceId: string, period: string) {
  await asSuperuser(async (db) => {
    const { rows } = await db.query(
      "insert into public.carts (guest_id) values ($1) on conflict (guest_id) do update set updated_at = now() returning id",
      [guestId],
    );
    await db.query(
      "insert into public.cart_items (cart_id, space_id, period) values ($1, $2, $3)",
      [rows[0].id, spaceId, period],
    );
  });
}

const createOrder = (db: Db, guestId: string) =>
  db.query("select * from public.create_order_from_cart($1)", [guestId]).then((r) => r.rows[0]);

beforeEach(async () => {
  host = await createHostWithSpace({ price: 1000 });
  await openAllDay(host.spaceId);
  guest = await approvedGuest();
});

describe("create_order_from_cart", () => {
  it("カゴの内容から注文・予約・料金内訳を作る。金額は DB 側で計算し、core と一致する", async () => {
    const d = tomorrow();
    await addToCart(guest, host.spaceId, range(d, "10:00", "11:30"));
    await addToCart(guest, host.spaceId, range(d, "13:00", "14:00"));
    const order = await asSuperuser((db) => createOrder(db, guest));
    const f1 = calcBookingFees({ pricePer30min: 1000, slots: 3 });
    const f2 = calcBookingFees({ pricePer30min: 1000, slots: 2 });
    expect(order.total).toBe(f1.subtotal + f2.subtotal);
    expect(order.application_fee_amount).toBe(f1.applicationFee + f2.applicationFee);
    expect(order.order_number).toMatch(/^T-\d{8}$/);
    expect(order.host_stripe_account_id).toMatch(/^acct_/);

    const { rows } = await asSuperuser((db) =>
      db.query(
        `select b.status, b.slots, f.hours, f.stripe_fee_estimated, f.application_fee
         from public.bookings b join public.booking_fees f on f.booking_id = b.id
         where b.order_id = $1 order by lower(b.period)`,
        [order.order_id],
      ),
    );
    expect(rows).toEqual([
      {
        status: "pending",
        slots: 3,
        hours: 2,
        stripe_fee_estimated: f1.stripeFeeEstimated,
        application_fee: f1.applicationFee,
      },
      {
        status: "pending",
        slots: 2,
        hours: 1,
        stripe_fee_estimated: f2.stripeFeeEstimated,
        application_fee: f2.applicationFee,
      },
    ]);
  });

  it("本人確認が済んでいない利用者は注文できない", async () => {
    const notApproved = await createUser("guest");
    await addToCart(notApproved, host.spaceId, range(tomorrow(), "10:00", "11:00"));
    await asSuperuser(async (db) => {
      await expect(createOrder(db, notApproved)).rejects.toThrow(/identity_not_approved/);
    });
  });

  it("他の方が先に予約した枠は slot_taken になり、注文は残らない", async () => {
    const other = await approvedGuest();
    const period = range(tomorrow(), "10:00", "11:00");
    await addToCart(other, host.spaceId, period);
    await addToCart(guest, host.spaceId, period);
    await asSuperuser((db) => createOrder(db, other));
    await asSuperuser(async (db) => {
      await expect(createOrder(db, guest)).rejects.toThrow(/slot_taken/);
      const { rows } = await db.query(
        "select count(*)::int as n from public.orders where guest_id = $1",
        [guest],
      );
      expect(rows[0].n).toBe(0);
    });
  });

  it("同じ枠を同時に購入すると、1件だけ成功する", async () => {
    const guests = [guest, await approvedGuest(), await approvedGuest()];
    const period = range(tomorrow(), "15:00", "16:00");
    for (const g of guests) await addToCart(g, host.spaceId, period);
    const results = await Promise.allSettled(
      guests.map((g) => asSuperuser((db) => createOrder(db, g))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((x) => x.status === "rejected")) {
      expect(String((r as PromiseRejectedResult).reason)).toMatch(/slot_taken/);
    }
  });

  it("Stripe で決済できない貸出主の予約はできない", async () => {
    await addToCart(guest, host.spaceId, range(tomorrow(), "10:00", "11:00"));
    await asSuperuser((db) =>
      db.query("update public.hosts set charges_enabled = false where id = $1", [host.hostId]),
    );
    await asSuperuser(async (db) => {
      await expect(createOrder(db, guest)).rejects.toThrow(/host_unavailable/);
    });
  });

  it("ブラウザから（authenticated・anon）は呼べない", async () => {
    for (const actor of [user(guest), anon]) {
      await as(actor, async (db) => {
        await expectError(db, "select * from public.create_order_from_cart($1)", [guest]);
      });
    }
  });
});

describe("is_bookable_period は core の validateBookingPeriod と同じ判定をする", () => {
  it.each([
    ["営業時間内", "10:00", "11:00", true],
    ["営業時間の端から端まで", "09:00", "18:00", true],
    ["開店前を含む", "08:30", "09:30", false],
    ["閉店後を含む", "17:30", "18:30", false],
  ])("%s", async (_label, from, to, expected) => {
    const d = tomorrow();
    const period = range(d, from, to);
    const { rows } = await asSuperuser((db) =>
      db.query("select private.is_bookable_period($1, $2, 1) as ok", [host.spaceId, period]),
    );
    expect(rows[0].ok).toBe(expected);
    const core = validateBookingPeriod({
      start: new Date(at(d, from)),
      end: new Date(at(d, to)),
      minSlots: 1,
      rules: Array.from({ length: 7 }, (_, wd) => ({
        weekday: wd,
        openTime: "09:00",
        closeTime: "18:00",
      })),
      closures: [],
      busy: [],
      now: new Date(),
    });
    expect(core.ok).toBe(expected);
  });

  it("休業日・最低利用枠数未満・過去・30日より先は予約できない", async () => {
    const d = tomorrow();
    await asSuperuser(async (db) => {
      const q = (period: string, minSlots = 1) =>
        db
          .query("select private.is_bookable_period($1, $2, $3) as ok", [
            host.spaceId,
            period,
            minSlots,
          ])
          .then((r) => r.rows[0].ok);
      expect(await q(range(d, "10:00", "10:30"), 2)).toBe(false);
      expect(await q(range(toTokyoDate(new Date(Date.now() - 86_400_000)), "10:00", "11:00"))).toBe(
        false,
      );
      expect(await q(range(addDays(d, 40), "10:00", "11:00"))).toBe(false);
      await db.query("insert into public.closures (space_id, date) values ($1, $2)", [
        host.spaceId,
        d,
      ]);
      expect(await q(range(d, "10:00", "11:00"))).toBe(false);
    });
  });
});

describe("mark_order_paid", () => {
  async function pendingOrder() {
    await addToCart(guest, host.spaceId, range(tomorrow(), "10:00", "11:00"));
    const order = await asSuperuser((db) => createOrder(db, guest));
    const pi = `pi_${uid().slice(0, 12)}`;
    await asSuperuser((db) =>
      db.query("select public.set_order_payment_intent($1, $2)", [order.order_id, pi]),
    );
    return { order, pi };
  }

  it("支払いが成功したら paid・confirmed にし、カゴから外す。2回目は already_paid", async () => {
    const { order, pi } = await pendingOrder();
    await as(serviceRole, async (db) => {
      const first = await db.query(
        "select public.mark_order_paid($1, $2, $3, 'ch_1', 'tr_1') as r",
        [order.order_id, pi, order.total],
      );
      expect(first.rows[0].r).toBe("paid");
      const second = await db.query(
        "select public.mark_order_paid($1, $2, $3, 'ch_1', 'tr_1') as r",
        [order.order_id, pi, order.total],
      );
      expect(second.rows[0].r).toBe("already_paid");
      const b = await db.query("select status from public.bookings where order_id = $1", [
        order.order_id,
      ]);
      expect(b.rows).toEqual([{ status: "confirmed" }]);
      const o = await db.query(
        "select status, stripe_charge_id, stripe_transfer_id from public.orders where id = $1",
        [order.order_id],
      );
      expect(o.rows[0]).toEqual({
        status: "paid",
        stripe_charge_id: "ch_1",
        stripe_transfer_id: "tr_1",
      });
      const c = await db.query(
        "select count(*)::int as n from public.cart_items ci join public.carts c on c.id = ci.cart_id where c.guest_id = $1",
        [guest],
      );
      expect(c.rows[0].n).toBe(0);
    });
  });

  it("金額や PaymentIntent が一致しなければエラー", async () => {
    const { order, pi } = await pendingOrder();
    await as(serviceRole, async (db) => {
      expect(
        await expectError(db, "select public.mark_order_paid($1, $2, 1, null, null)", [
          order.order_id,
          pi,
        ]),
      ).toMatch(/amount_mismatch/);
      expect(
        await expectError(db, "select public.mark_order_paid($1, 'pi_other', $2, null, null)", [
          order.order_id,
          order.total,
        ]),
      ).toMatch(/payment_intent_mismatch/);
    });
  });

  it("期限切れのあとに支払いが成功したら late を返す（自動で全額返金する。D8）", async () => {
    const { order, pi } = await pendingOrder();
    await as(serviceRole, async (db) => {
      const closed = await db.query("select public.close_pending_order($1, 'expired') as pi", [
        order.order_id,
      ]);
      expect(closed.rows[0].pi).toBe(pi);
      const b = await db.query("select status from public.bookings where order_id = $1", [
        order.order_id,
      ]);
      expect(b.rows).toEqual([{ status: "expired" }]);
      const r = await db.query("select public.mark_order_paid($1, $2, $3, 'ch', 'tr') as r", [
        order.order_id,
        pi,
        order.total,
      ]);
      expect(r.rows[0].r).toBe("late");
    });
  });
});

describe("expire_due_orders", () => {
  it("15分以上 pending の注文を expired にして枠を解放する", async () => {
    const period = range(tomorrow(), "16:00", "17:00");
    await addToCart(guest, host.spaceId, period);
    const order = await asSuperuser((db) => createOrder(db, guest));
    await asSuperuser((db) =>
      db.query("update public.orders set expires_at = now() - interval '1 minute' where id = $1", [
        order.order_id,
      ]),
    );
    const { rows } = await asSuperuser((db) =>
      db.query("select * from public.expire_due_orders()"),
    );
    expect(rows.map((r) => r.order_id)).toContain(order.order_id);

    // 解放された枠は、ほかの利用者が購入できる
    const other = await approvedGuest();
    await addToCart(other, host.spaceId, period);
    const second = await asSuperuser((db) => createOrder(db, other));
    expect(second.order_id).toBeTruthy();
  });
});
