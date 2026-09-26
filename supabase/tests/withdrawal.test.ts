import { describe, expect, it } from "vitest";
import { as, asSuperuser, expectError, uid, user } from "./helpers/db";
import { createHostWithSpace, createUser } from "./helpers/fixtures";

describe("withdraw_account（D36）", () => {
  it("これからの予約があると退会できない。なくなれば退会でき、退会日が入る", async () => {
    const h = await createHostWithSpace();
    const guest = await createUser();
    const orderId = uid();
    await asSuperuser(async (db) => {
      await db.query(
        `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, status, paid_at, expires_at)
         values ($1, $2, $3, 2000, 292, 'paid', now(), now())`,
        [orderId, guest, h.hostId],
      );
      await db.query(
        `insert into public.bookings (order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status)
         values ($1, $2, $3, $4, tstzrange('2033-01-01 10:00+09', '2033-01-01 11:00+09', '[)'), 2, 1000, 2000, 'confirmed')`,
        [orderId, h.spaceId, guest, h.hostId],
      );
    });
    await as(user(guest), async (db) => {
      expect(await expectError(db, "select public.withdraw_account()")).toMatch(
        /has_upcoming_bookings/,
      );
    });
    await asSuperuser((db) =>
      db.query(
        "update public.bookings set status = 'cancelled', cancelled_by = 'guest', cancelled_at = now(), cancel_policy = 'full' where order_id = $1",
        [orderId],
      ),
    );
    await asSuperuser(async (db) => {
      await db.query("begin");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: guest, role: "authenticated" }),
      ]);
      await db.query("set local role authenticated");
      await db.query("select public.withdraw_account()");
      await db.query("commit");
    });
    const { rows } = await asSuperuser((db) =>
      db.query(
        "select withdrawn_at is not null as w, deleted_at is not null as d from public.profiles where id = $1",
        [guest],
      ),
    );
    expect(rows[0]).toEqual({ w: true, d: true });
    // 退会後はプロフィールの更新などもできない（profiles_update_self は deleted_at is null が条件）
    await as(user(guest), async (db) => {
      const r = await db.query("update public.profiles set display_name = 'x' where id = $1", [
        guest,
      ]);
      expect(r.rowCount).toBe(0);
      expect(await expectError(db, "select public.withdraw_account()")).toMatch(/not_allowed/);
    });
  });

  it("貸出主の担当者は画面から退会できない", async () => {
    const h = await createHostWithSpace();
    await as(user(h.memberId), async (db) => {
      expect(await expectError(db, "select public.withdraw_account()")).toMatch(/not_guest/);
    });
  });
});
