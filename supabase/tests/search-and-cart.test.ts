import { describe, expect, it } from "vitest";
import { anon, as, asSuperuser, expectError, uid, user } from "./helpers/db";
import { createHostWithSpace, createOrderWithBooking, createUser } from "./helpers/fixtures";

async function rename(spaceId: string, name: string, area: string, capacity = 8) {
  await asSuperuser((db) =>
    db.query("update public.spaces set name = $2, area = $3, capacity = $4 where id = $1", [
      spaceId,
      name,
      area,
      capacity,
    ]),
  );
}

describe("search_spaces", () => {
  it("公開中・貸出主が active のスペースだけを、キーワード（名前・エリア）と人数で絞り込む", async () => {
    const tag = uid().slice(0, 8);
    const a = await createHostWithSpace();
    const b = await createHostWithSpace();
    const draft = await createHostWithSpace({ ready: false });
    await rename(a.spaceId, `会議室${tag}`, "渋谷", 4);
    await rename(b.spaceId, "大会議室", `新宿${tag}`, 20);
    await rename(draft.spaceId, `下書き${tag}`, "渋谷", 20);

    await as(anon, async (db) => {
      const all = await db.query("select id from public.search_spaces($1)", [tag]);
      expect(all.rows.map((r) => r.id).sort()).toEqual([a.spaceId, b.spaceId].sort());
      const big = await db.query("select id, company_name from public.search_spaces($1, 10)", [
        tag,
      ]);
      expect(big.rows).toEqual([{ id: b.spaceId, company_name: "テスト株式会社" }]);
    });

    await asSuperuser((db) =>
      db.query("update public.hosts set status = 'suspended' where id = $1", [b.hostId]),
    );
    await as(anon, async (db) => {
      const r = await db.query("select id from public.search_spaces($1)", [tag]);
      expect(r.rows.map((x) => x.id)).toEqual([a.spaceId]);
    });
  });

  it("キーワードの % や _ は文字として扱う", async () => {
    await as(anon, async (db) => {
      const r = await db.query("select count(*)::int as n from public.search_spaces('%')");
      expect(r.rows[0].n).toBe(0);
    });
  });
});

describe("spaces_busy_periods", () => {
  it("公開中のスペースの予約済みの期間だけを返す", async () => {
    const pub = await createHostWithSpace();
    const draft = await createHostWithSpace({ ready: false });
    const guest = await createUser();
    await asSuperuser(async (db) => {
      await createOrderWithBooking(db, {
        guestId: guest,
        hostId: pub.hostId,
        spaceId: pub.spaceId,
        period: "[2026-12-10 10:00+09, 2026-12-10 11:00+09)",
      });
      await createOrderWithBooking(db, {
        guestId: guest,
        hostId: draft.hostId,
        spaceId: draft.spaceId,
        period: "[2026-12-10 10:00+09, 2026-12-10 11:00+09)",
      });
    });
    await as(anon, async (db) => {
      const r = await db.query(
        "select space_id from public.spaces_busy_periods($1, '2026-12-10 00:00+09', '2026-12-11 00:00+09')",
        [[pub.spaceId, draft.spaceId]],
      );
      expect(r.rows).toEqual([{ space_id: pub.spaceId }]);
    });
  });
});

describe("予約カゴ", () => {
  it("同じスペースの重なる時間帯は入れられない。10件まで", async () => {
    const h = await createHostWithSpace();
    const guest = await createUser();
    await as(user(guest), async (db) => {
      const { rows } = await db.query(
        "insert into public.carts (guest_id) values ($1) returning id",
        [guest],
      );
      const cartId = rows[0].id;
      const add = (period: string) =>
        db.query("insert into public.cart_items (cart_id, space_id, period) values ($1, $2, $3)", [
          cartId,
          h.spaceId,
          period,
        ]);
      await add("[2026-12-01 10:00+09, 2026-12-01 11:00+09)");
      expect(
        await expectError(
          db,
          "insert into public.cart_items (cart_id, space_id, period) values ($1, $2, '[2026-12-01 10:30+09, 2026-12-01 11:30+09)')",
          [cartId, h.spaceId],
        ),
      ).toMatch(/cart_items_no_overlap/);
      for (let d = 2; d <= 10; d++)
        await add(
          `[2026-12-${String(d).padStart(2, "0")} 10:00+09, 2026-12-${String(d).padStart(2, "0")} 11:00+09)`,
        );
      expect(
        await expectError(
          db,
          "insert into public.cart_items (cart_id, space_id, period) values ($1, $2, '[2026-12-20 10:00+09, 2026-12-20 11:00+09)')",
          [cartId, h.spaceId],
        ),
      ).toMatch(/cart_full/);
    });
  });

  it("貸出主のアカウントはカゴを作れない", async () => {
    const h = await createHostWithSpace();
    await as(user(h.memberId), async (db) => {
      await expectError(db, "insert into public.carts (guest_id) values ($1)", [h.memberId]);
    });
  });
});
