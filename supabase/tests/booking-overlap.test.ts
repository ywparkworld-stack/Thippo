import { beforeAll, describe, expect, it } from "vitest";
import { asSuperuser, getPool } from "./helpers/db";
import {
  createHostWithSpace,
  createOrderWithBooking,
  createUser,
  type HostFixture,
} from "./helpers/fixtures";

let host: HostFixture;
let guest1: string;
let guest2: string;

beforeAll(async () => {
  host = await createHostWithSpace();
  guest1 = await createUser();
  guest2 = await createUser();
});

describe("ダブルブッキングの防止（排他制約）", () => {
  it("重なる時間帯の予約は作れない", async () => {
    await asSuperuser(async (db) => {
      await db.query("begin");
      try {
        await createOrderWithBooking(db, {
          guestId: guest1,
          hostId: host.hostId,
          spaceId: host.spaceId,
          period: "[2026-11-01 10:00+09, 2026-11-01 12:00+09)",
        });
        await expect(
          createOrderWithBooking(db, {
            guestId: guest2,
            hostId: host.hostId,
            spaceId: host.spaceId,
            period: "[2026-11-01 11:30+09, 2026-11-01 12:30+09)",
          }),
        ).rejects.toThrow(/bookings_no_overlap/);
      } finally {
        await db.query("rollback");
      }
    });
  });

  it("隣り合う時間帯（終了 = 次の開始）は予約できる", async () => {
    await asSuperuser(async (db) => {
      await db.query("begin");
      try {
        await createOrderWithBooking(db, {
          guestId: guest1,
          hostId: host.hostId,
          spaceId: host.spaceId,
          period: "[2026-11-02 10:00+09, 2026-11-02 11:00+09)",
        });
        await createOrderWithBooking(db, {
          guestId: guest2,
          hostId: host.hostId,
          spaceId: host.spaceId,
          period: "[2026-11-02 11:00+09, 2026-11-02 12:00+09)",
        });
      } finally {
        await db.query("rollback");
      }
    });
  });

  it("キャンセル済み・期限切れの予約とは重なってもよい", async () => {
    await asSuperuser(async (db) => {
      await db.query("begin");
      try {
        const { bookingId } = await createOrderWithBooking(db, {
          guestId: guest1,
          hostId: host.hostId,
          spaceId: host.spaceId,
          period: "[2026-11-03 10:00+09, 2026-11-03 11:00+09)",
        });
        await db.query(
          "update public.bookings set status = 'cancelled', cancelled_by = 'guest', cancelled_at = now(), cancel_policy = 'full' where id = $1",
          [bookingId],
        );
        await createOrderWithBooking(db, {
          guestId: guest2,
          hostId: host.hostId,
          spaceId: host.spaceId,
          period: "[2026-11-03 10:00+09, 2026-11-03 11:00+09)",
        });
      } finally {
        await db.query("rollback");
      }
    });
  });

  it("同じ時間帯を同時に購入すると、後の購入は DB の制約で拒否される", async () => {
    const pool = getPool();
    const [c1, c2] = await Promise.all([pool.connect(), pool.connect()]);
    try {
      await c1.query("begin");
      await c2.query("begin");
      const period = "[2026-11-04 10:00+09, 2026-11-04 11:00+09)";
      // 1人目の insert はコミット前。2人目の insert は1人目の結果を待ってから判定される。
      await createOrderWithBooking(c1, {
        guestId: guest1,
        hostId: host.hostId,
        spaceId: host.spaceId,
        period,
      });
      const second = createOrderWithBooking(c2, {
        guestId: guest2,
        hostId: host.hostId,
        spaceId: host.spaceId,
        period,
      });
      await new Promise((r) => setTimeout(r, 200));
      await c1.query("commit");
      await expect(second).rejects.toThrow(/bookings_no_overlap/);
      await c2.query("rollback");

      const { rows } = await c1.query(
        "select guest_id from public.bookings where space_id = $1 and period && $2::tstzrange and status in ('pending','confirmed')",
        [host.spaceId, period],
      );
      expect(rows).toEqual([{ guest_id: guest1 }]);
    } finally {
      await c1.query("rollback").catch(() => undefined);
      await c2.query("rollback").catch(() => undefined);
      c1.release();
      c2.release();
    }
  });

  it("30分刻みでない期間・枠数や金額が合わない予約は作れない", async () => {
    await asSuperuser(async (db) => {
      await db.query("begin");
      try {
        await db.query("savepoint s");
        await expect(
          createOrderWithBooking(db, {
            guestId: guest1,
            hostId: host.hostId,
            spaceId: host.spaceId,
            period: "[2026-11-05 10:15+09, 2026-11-05 11:00+09)",
          }),
        ).rejects.toThrow(/bookings_period_30min/);
        await db.query("rollback to savepoint s");

        const { orderId } = await createOrderWithBooking(db, {
          guestId: guest1,
          hostId: host.hostId,
          spaceId: host.spaceId,
          period: "[2026-11-05 13:00+09, 2026-11-05 14:00+09)",
        });
        await db.query("savepoint s2");
        await expect(
          db.query(
            `insert into public.bookings (order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total)
             values ($1, $2, $3, $4, '[2026-11-05 15:00+09, 2026-11-05 16:00+09)', 3, 1000, 3000)`,
            [orderId, host.spaceId, guest1, host.hostId],
          ),
        ).rejects.toThrow(/bookings_slots_match_period/);
        await db.query("rollback to savepoint s2");
        await expect(
          db.query(
            `insert into public.bookings (order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total)
             values ($1, $2, $3, $4, '[2026-11-05 15:00+09, 2026-11-05 16:00+09)', 2, 1000, 1999)`,
            [orderId, host.spaceId, guest1, host.hostId],
          ),
        ).rejects.toThrow(/bookings_total_match/);
        await db.query("rollback to savepoint s2");
        // 注文と違う利用者の予約は作れない
        await expect(
          db.query(
            `insert into public.bookings (order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total)
             values ($1, $2, $3, $4, '[2026-11-05 15:00+09, 2026-11-05 16:00+09)', 2, 1000, 2000)`,
            [orderId, host.spaceId, guest2, host.hostId],
          ),
        ).rejects.toThrow(/foreign key/);
      } finally {
        await db.query("rollback");
      }
    });
  });
});
