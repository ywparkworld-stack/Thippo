import { describe, expect, it } from "vitest";
import { anon, as, asSuperuser, expectError, serviceRole, uid, user } from "./helpers/db";
import { createUser } from "./helpers/fixtures";

describe("consume_rate_limit", () => {
  it("上限までは許可し、超えたら拒否する", async () => {
    const key = `test:${uid()}`;
    await as(serviceRole, async (db) => {
      const results = [];
      for (let i = 0; i < 4; i++) {
        const { rows } = await db.query("select * from public.consume_rate_limit($1, 3, 600)", [
          key,
        ]);
        results.push(rows[0]);
      }
      expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
      expect(results.map((r) => r.hits)).toEqual([1, 2, 3, 4]);
      expect(results[3].retry_after_seconds).toBeGreaterThan(0);
      expect(results[3].retry_after_seconds).toBeLessThanOrEqual(600);
    });
  });

  it("キーが違えば別に数える", async () => {
    await as(serviceRole, async (db) => {
      const a = await db.query("select * from public.consume_rate_limit($1, 1, 600)", [
        `a:${uid()}`,
      ]);
      const b = await db.query("select * from public.consume_rate_limit($1, 1, 600)", [
        `b:${uid()}`,
      ]);
      expect([a.rows[0].allowed, b.rows[0].allowed]).toEqual([true, true]);
    });
  });

  it("同時に呼んでも数え漏れがない", async () => {
    const key = `concurrent:${uid()}`;
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        asSuperuser((db) =>
          db.query("select * from public.consume_rate_limit($1, 10, 600)", [key]),
        ),
      ),
    );
    const allowed = results.filter((r) => r.rows[0].allowed).length;
    expect(allowed).toBe(10);
  });

  it("ブラウザ（anon / authenticated）からは呼べない", async () => {
    const someone = await createUser();
    for (const actor of [anon, user(someone)]) {
      await as(actor, async (db) => {
        const msg = await expectError(db, "select * from public.consume_rate_limit('x', 100, 60)");
        expect(msg).toMatch(/permission denied/);
      });
    }
  });
});

describe("write_audit_log", () => {
  it("DB 関数の中から記録でき、ブラウザからは直接呼べない", async () => {
    const adminId = await createUser("admin");
    await asSuperuser(async (db) => {
      const { rows } = await db.query(
        "select private.write_audit_log($1, 'identity.approve', 'identity_documents', 'x', '{\"a\":1}') as id",
        [adminId],
      );
      expect(Number(rows[0].id)).toBeGreaterThan(0);
      await expect(
        db.query("select private.write_audit_log($1, 'Bad Action')", [adminId]),
      ).rejects.toThrow(/invalid audit action/);
    });
    await as(user(adminId, "aal2"), async (db) => {
      const msg = await expectError(db, "select private.write_audit_log($1, 'identity.approve')", [
        adminId,
      ]);
      expect(msg).toMatch(/permission denied/);
    });
  });
});
