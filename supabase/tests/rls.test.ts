import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, asSuperuser, expectError, serviceRole, uid, user } from "./helpers/db";
import {
  createHostWithSpace,
  createOrderWithBooking,
  createUser,
  type HostFixture,
} from "./helpers/fixtures";

let guestA: string;
let guestB: string;
let adminId: string;
let hostX: HostFixture;
let hostY: HostFixture;
let bookingA: string;
let bookingB: string;
let docA: string;

beforeAll(async () => {
  guestA = await createUser("guest");
  guestB = await createUser("guest");
  adminId = await createUser("admin");
  hostX = await createHostWithSpace();
  hostY = await createHostWithSpace();
  await asSuperuser(async (db) => {
    bookingA = (
      await createOrderWithBooking(db, {
        guestId: guestA,
        hostId: hostX.hostId,
        spaceId: hostX.spaceId,
        period: "[2026-10-01 10:00+09, 2026-10-01 11:00+09)",
      })
    ).bookingId;
    bookingB = (
      await createOrderWithBooking(db, {
        guestId: guestB,
        hostId: hostY.hostId,
        spaceId: hostY.spaceId,
        period: "[2026-10-01 10:00+09, 2026-10-01 11:00+09)",
      })
    ).bookingId;
    docA = uid();
    await db.query(
      "insert into public.identity_documents (id, user_id, storage_path) values ($1, $2, $3)",
      [docA, guestA, `${guestA}/license.jpg`],
    );
    await db.query(
      "insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)",
      [`${guestA}/license.jpg`, guestA],
    );
    await db.query("insert into public.audit_logs (actor_id, action) values ($1, 'test.seed')", [
      adminId,
    ]);
  });
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("利用者", () => {
  it("自分の予約は読めるが、他人の予約は読めない", async () => {
    await as(user(guestA), async (db) => {
      const { rows } = await db.query("select id from public.bookings");
      expect(ids(rows)).toEqual([bookingA]);
      const other = await db.query("select id from public.bookings where id = $1", [bookingB]);
      expect(other.rowCount).toBe(0);
      const orders = await db.query("select guest_id from public.orders");
      expect(orders.rows.every((r) => r.guest_id === guestA)).toBe(true);
    });
  });

  it("他人の本人確認書類（テーブル・ストレージ）は読めない", async () => {
    await as(user(guestB), async (db) => {
      expect((await db.query("select id from public.identity_documents")).rowCount).toBe(0);
      expect(
        (await db.query("select name from storage.objects where bucket_id = 'identity-documents'"))
          .rowCount,
      ).toBe(0);
    });
    await as(user(guestA), async (db) => {
      expect(ids((await db.query("select id from public.identity_documents")).rows)).toEqual([
        docA,
      ]);
      expect(
        (await db.query("select name from storage.objects where bucket_id = 'identity-documents'"))
          .rowCount,
      ).toBe(1);
    });
  });

  it("本人確認書類は自分のフォルダにだけアップロードできる", async () => {
    await as(user(guestB), async (db) => {
      await db.query(
        "insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)",
        [`${guestB}/a.jpg`, guestB],
      );
      await expectError(
        db,
        "insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)",
        [`${guestA}/b.jpg`, guestB],
      );
      await expectError(
        db,
        "insert into public.identity_documents (user_id, storage_path) values ($1, $2)",
        [guestA, `${guestA}/c.jpg`],
      );
      await db.query(
        "insert into public.identity_documents (user_id, storage_path) values ($1, $2)",
        [guestB, `${guestB}/a.jpg`],
      );
    });
  });

  it("本人確認の審査結果やロールを自分で書き換えられない", async () => {
    await as(user(guestA), async (db) => {
      await expectError(
        db,
        "update public.profiles set identity_status = 'approved' where id = $1",
        [guestA],
      );
      await expectError(db, "update public.profiles set role = 'admin' where id = $1", [guestA]);
      await expectError(db, "update public.profiles set role = 'host' where id = $1", [guestA]);
      await expectError(
        db,
        "update public.identity_documents set status = 'approved' where id = $1",
        [docA],
      );
      const ok = await db.query("update public.profiles set display_name = '山田' where id = $1", [
        guestA,
      ]);
      expect(ok.rowCount).toBe(1);
      const other = await db.query(
        "update public.profiles set display_name = '山田' where id = $1",
        [guestB],
      );
      expect(other.rowCount).toBe(0);
    });
  });

  it("注文・予約・返金を直接書き込めない", async () => {
    await as(user(guestA), async (db) => {
      await expectError(db, "update public.bookings set status = 'cancelled' where id = $1", [
        bookingA,
      ]);
      await expectError(db, "update public.orders set status = 'paid'");
      await expectError(db, "delete from public.bookings where id = $1", [bookingA]);
      await expectError(
        db,
        "insert into public.refunds (booking_id, policy, refund_amount, transfer_reversal_amount, platform_fee_excl_tax, platform_fee_tax) values ($1, 'full', 1, 0, 0, 0)",
        [bookingA],
      );
      await expectError(
        db,
        "insert into public.cancel_events (user_id, booking_id) values ($1, $2)",
        [guestA, bookingA],
      );
    });
  });
});

describe("貸出主", () => {
  it("自社の予約は読めるが、他社の予約は読めない", async () => {
    await as(user(hostX.memberId), async (db) => {
      const { rows } = await db.query("select id, host_id from public.bookings");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.host_id === hostX.hostId)).toBe(true);
      expect(
        (await db.query("select id from public.bookings where id = $1", [bookingB])).rowCount,
      ).toBe(0);
      expect(
        (await db.query("select id from public.orders where host_id = $1", [hostY.hostId]))
          .rowCount,
      ).toBe(0);
      expect(
        (await db.query("select id from public.hosts where id = $1", [hostY.hostId])).rowCount,
      ).toBe(0);
    });
  });

  it("利用者の本人確認書類やプロフィールは読めない", async () => {
    await as(user(hostX.memberId), async (db) => {
      expect((await db.query("select id from public.identity_documents")).rowCount).toBe(0);
      expect(
        (await db.query("select id from public.profiles where id = $1", [guestA])).rowCount,
      ).toBe(0);
    });
  });

  it("他社のスペースは編集できない", async () => {
    await as(user(hostX.memberId), async (db) => {
      const r = await db.query("update public.spaces set name = '乗っ取り' where id = $1", [
        hostY.spaceId,
      ]);
      expect(r.rowCount).toBe(0);
      await expectError(
        db,
        "insert into public.spaces (host_id, name, address, area, capacity, price_per_30min) values ($1, 'x', 'x', 'x', 1, 1000)",
        [hostY.hostId],
      );
    });
  });

  it("自社のスペースは編集できるが、公開停止の解除・Stripe 情報・会社のステータスは変えられない", async () => {
    await as(user(hostX.memberId), async (db) => {
      const r = await db.query("update public.spaces set name = '会議室B' where id = $1", [
        hostX.spaceId,
      ]);
      expect(r.rowCount).toBe(1);
      await expectError(db, "update public.spaces set status = 'suspended' where id = $1", [
        hostX.spaceId,
      ]);
      await expectError(db, "update public.hosts set charges_enabled = true where id = $1", [
        hostX.hostId,
      ]);
      await expectError(db, "update public.hosts set status = 'active' where id = $1", [
        hostX.hostId,
      ]);
      await expectError(db, "update public.hosts set stripe_account_id = 'acct_x' where id = $1", [
        hostX.hostId,
      ]);
    });
    await asSuperuser((db) =>
      db.query("update public.spaces set status = 'suspended' where id = $1", [hostX.spaceId]),
    );
    try {
      await as(user(hostX.memberId), async (db) => {
        await expectError(db, "update public.spaces set status = 'published' where id = $1", [
          hostX.spaceId,
        ]);
      });
    } finally {
      await asSuperuser((db) =>
        db.query("update public.spaces set status = 'published' where id = $1", [hostX.spaceId]),
      );
    }
  });

  it("新しいスペースは下書きでしか作れず、料金の下限を下回れない", async () => {
    await as(user(hostX.memberId), async (db) => {
      await expectError(
        db,
        "insert into public.spaces (host_id, name, address, area, capacity, price_per_30min, status) values ($1, 'x', 'x', 'x', 1, 1000, 'published')",
        [hostX.hostId],
      );
      const msg = await expectError(
        db,
        "insert into public.spaces (host_id, name, address, area, capacity, price_per_30min) values ($1, 'x', 'x', 'x', 1, 236)",
        [hostX.hostId],
      );
      expect(msg).toMatch(/out of range/);
      await db.query(
        "insert into public.spaces (host_id, name, address, area, capacity, price_per_30min) values ($1, 'x', 'x', 'x', 1, 237)",
        [hostX.hostId],
      );
    });
  });

  it("Stripe のオンボーディングが終わっていない貸出主はスペースを公開できない", async () => {
    const notReady = await createHostWithSpace({ ready: false });
    await asSuperuser((db) =>
      db.query("update public.hosts set status = 'active' where id = $1", [notReady.hostId]),
    );
    await as(user(notReady.memberId), async (db) => {
      const msg = await expectError(
        db,
        "update public.spaces set status = 'published' where id = $1",
        [notReady.spaceId],
      );
      expect(msg).toMatch(/not ready/);
    });
  });
});

describe("公開情報", () => {
  it("未ログインでも公開中のスペースは見られるが、下書きや停止中の貸出主のスペースは見られない", async () => {
    const draft = await createHostWithSpace({ ready: false });
    await as(anon, async (db) => {
      expect(
        (await db.query("select id from public.spaces where id = $1", [hostX.spaceId])).rowCount,
      ).toBe(1);
      expect(
        (await db.query("select id from public.spaces where id = $1", [draft.spaceId])).rowCount,
      ).toBe(0);
      await expectError(db, "select id from public.bookings");
      await expectError(db, "select id from public.profiles");
    });
    await asSuperuser((db) =>
      db.query("update public.hosts set status = 'suspended' where id = $1", [hostY.hostId]),
    );
    try {
      await as(anon, async (db) => {
        expect(
          (await db.query("select id from public.spaces where id = $1", [hostY.spaceId])).rowCount,
        ).toBe(0);
      });
    } finally {
      await asSuperuser((db) =>
        db.query("update public.hosts set status = 'active' where id = $1", [hostY.hostId]),
      );
    }
  });
});

describe("運営（admin）", () => {
  it("2段階認証済み（aal2）なら全件読める", async () => {
    await as(user(adminId, "aal2"), async (db) => {
      const { rows } = await db.query("select id from public.bookings where id = any($1)", [
        [bookingA, bookingB],
      ]);
      expect(rows).toHaveLength(2);
      expect(
        (await db.query("select id from public.identity_documents where id = $1", [docA])).rowCount,
      ).toBe(1);
      expect((await db.query("select id from public.audit_logs")).rowCount).toBeGreaterThan(0);
    });
  });

  it("2段階認証をしていない（aal1）admin は運営用のデータを読めない", async () => {
    await as(user(adminId, "aal1"), async (db) => {
      expect((await db.query("select id from public.bookings")).rowCount).toBe(0);
      expect((await db.query("select id from public.identity_documents")).rowCount).toBe(0);
      expect((await db.query("select id from public.audit_logs")).rowCount).toBe(0);
    });
  });

  it("admin であっても、運営用のデータはブラウザから直接書き込めない（サーバー・DB 関数経由のみ）", async () => {
    await as(user(adminId, "aal2"), async (db) => {
      await expectError(db, "insert into public.audit_logs (actor_id, action) values ($1, 'x')", [
        adminId,
      ]);
      await expectError(
        db,
        "update public.identity_documents set status = 'approved' where id = $1",
        [docA],
      );
      await expectError(db, "update public.profiles set status = 'suspended' where id = $1", [
        guestA,
      ]);
    });
  });

  it("admin 以外は運営用のデータに書き込めない", async () => {
    for (const actor of [user(guestA), user(hostX.memberId), anon]) {
      await as(actor, async (db) => {
        await expectError(db, "insert into public.audit_logs (actor_id, action) values ($1, 'x')", [
          adminId,
        ]);
        await expectError(
          db,
          "update public.identity_documents set status = 'approved' where id = $1",
          [docA],
        );
        await expectError(db, "update public.host_applications set status = 'approved'");
        await expectError(
          db,
          "insert into public.hosts (company_name, status) values ('x', 'active')",
        );
        await expectError(
          db,
          "insert into public.host_members (host_id, user_id) values ($1, $2)",
          [hostY.hostId, actor.id ?? guestA],
        );
        await expectError(db, "update public.monthly_statements set net = 0");
        await expectError(
          db,
          "insert into public.stripe_events (event_id, type, payload) values ('evt', 't', '{}')",
        );
      });
    }
  });

  it("admin ロールは画面（authenticated）からもサーバー（service_role）からも付与できない", async () => {
    await as(serviceRole, async (db) => {
      const msg = await expectError(db, "update public.profiles set role = 'admin' where id = $1", [
        guestA,
      ]);
      expect(msg).toMatch(/admin role/);
      // service_role でも admin を剥奪できない
      await expectError(db, "update public.profiles set role = 'guest' where id = $1", [adminId]);
      // host への変更（招待時）はできる
      const r = await db.query("update public.profiles set role = 'host' where id = $1", [guestB]);
      expect(r.rowCount).toBe(1);
    });
  });

  it("audit_logs は追記のみで、service_role でも変更・削除できない", async () => {
    await as(serviceRole, async (db) => {
      await db.query("insert into public.audit_logs (actor_id, action) values ($1, 'x')", [
        adminId,
      ]);
      await expectError(db, "update public.audit_logs set action = 'y'");
      await expectError(db, "delete from public.audit_logs");
    });
  });
});

describe("予約カゴ", () => {
  it("1つのカゴには同じ貸出主のスペースだけを入れられる", async () => {
    await as(user(guestA), async (db) => {
      const { rows } = await db.query(
        "insert into public.carts (guest_id) values ($1) returning id",
        [guestA],
      );
      const cartId = rows[0].id;
      await db.query(
        "insert into public.cart_items (cart_id, space_id, period) values ($1, $2, $3)",
        [cartId, hostX.spaceId, "[2026-10-02 10:00+09, 2026-10-02 11:00+09)"],
      );
      const msg = await expectError(
        db,
        "insert into public.cart_items (cart_id, space_id, period) values ($1, $2, $3)",
        [cartId, hostY.spaceId, "[2026-10-02 10:00+09, 2026-10-02 11:00+09)"],
      );
      expect(msg).toMatch(/予約カゴを分けて購入する必要があります/);
    });
  });

  it("他人のカゴは作れない・見られない", async () => {
    await as(user(guestB), async (db) => {
      await expectError(db, "insert into public.carts (guest_id) values ($1)", [guestA]);
    });
  });
});
