import { describe, expect, it } from "vitest";
import { anon, as, asSuperuser, expectError, serviceRole, uid, user } from "./helpers/db";
import { createHostWithSpace, createOrderWithBooking, createUser } from "./helpers/fixtures";

async function createApplication(email: string): Promise<string> {
  const { rows } = await asSuperuser((db) =>
    db.query(
      `insert into public.host_applications (company_name, contact_name, email, phone, address)
       values ('株式会社テスト', '佐藤', $1, '03-0000-0000', '東京都') returning id`,
      [email],
    ),
  );
  return rows[0].id;
}

/** 招待（inviteUserByEmail）の代わりに Auth ユーザーを作る */
async function invitee(email: string): Promise<string> {
  const id = uid();
  await asSuperuser((db) =>
    db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]),
  );
  return id;
}

describe("approve_host_application", () => {
  it("承認すると貸出主と担当者ができ、担当者のロールが host になる", async () => {
    const adminId = await createUser("admin");
    const email = `${uid()}@example.test`;
    const appId = await createApplication(email);
    const userId = await invitee(email);
    await as(user(adminId, "aal2"), async (db) => {
      const { rows } = await db.query("select public.approve_host_application($1, $2) as host_id", [
        appId,
        userId,
      ]);
      const hostId = rows[0].host_id;
      const host = await db.query("select company_name, status from public.hosts where id = $1", [
        hostId,
      ]);
      expect(host.rows[0]).toEqual({ company_name: "株式会社テスト", status: "active" });
      const prof = await db.query("select role, display_name from public.profiles where id = $1", [
        userId,
      ]);
      expect(prof.rows[0]).toEqual({ role: "host", display_name: "佐藤" });
      const member = await db.query(
        "select 1 from public.host_members where host_id = $1 and user_id = $2",
        [hostId, userId],
      );
      expect(member.rowCount).toBe(1);
      const log = await db.query("select action from public.audit_logs where target_id = $1", [
        appId,
      ]);
      expect(log.rows).toEqual([{ action: "host_application.approve" }]);
      // 二重に承認できない
      expect(
        await expectError(db, "select public.approve_host_application($1, $2)", [appId, userId]),
      ).toMatch(/application_not_pending/);
    });
  });

  it("利用者として使っているアカウントは担当者にできない（D6・D13）", async () => {
    const adminId = await createUser("admin");
    const guestId = await createUser("guest");
    const { rows } = await asSuperuser((db) =>
      db.query("select email from public.profiles where id = $1", [guestId]),
    );
    const appId = await createApplication(rows[0].email);
    await asSuperuser((db) =>
      db.query("update public.profiles set identity_status = 'pending' where id = $1", [guestId]),
    );
    await as(user(adminId, "aal2"), async (db) => {
      expect(
        await expectError(db, "select public.approve_host_application($1, $2)", [appId, guestId]),
      ).toMatch(/email_already_registered/);
    });
  });

  it("申込と違うメールアドレスのアカウントは担当者にできない", async () => {
    const adminId = await createUser("admin");
    const appId = await createApplication(`${uid()}@example.test`);
    const other = await invitee(`${uid()}@example.test`);
    await as(user(adminId, "aal2"), async (db) => {
      expect(
        await expectError(db, "select public.approve_host_application($1, $2)", [appId, other]),
      ).toMatch(/invalid_invitee/);
    });
  });

  it("aal2 の admin 以外は承認・却下できない", async () => {
    const adminId = await createUser("admin");
    const email = `${uid()}@example.test`;
    const appId = await createApplication(email);
    const userId = await invitee(email);
    for (const actor of [user(adminId, "aal1"), user(userId), anon]) {
      await as(actor, async (db) => {
        await expectError(db, "select public.approve_host_application($1, $2)", [appId, userId]);
        await expectError(db, "select public.reject_host_application($1, 'x')", [appId]);
      });
    }
  });

  it("却下には理由が必要", async () => {
    const adminId = await createUser("admin");
    const appId = await createApplication(`${uid()}@example.test`);
    await as(user(adminId, "aal2"), async (db) => {
      expect(
        await expectError(db, "select public.reject_host_application($1, ' ')", [appId]),
      ).toMatch(/reject_reason_required/);
      await db.query("select public.reject_host_application($1, '対象外の地域です')", [appId]);
      const { rows } = await db.query(
        "select status, reject_reason from public.host_applications where id = $1",
        [appId],
      );
      expect(rows[0]).toEqual({ status: "rejected", reject_reason: "対象外の地域です" });
    });
  });
});

describe("claim_stripe_event（Webhook の重複処理防止）", () => {
  it("同じイベントは一度しか処理しない", async () => {
    const id = `evt_${uid()}`;
    await as(serviceRole, async (db) => {
      const first = await db.query(
        "select public.claim_stripe_event($1, 'account.updated', '{}') as ok",
        [id],
      );
      const second = await db.query(
        "select public.claim_stripe_event($1, 'account.updated', '{}') as ok",
        [id],
      );
      expect([first.rows[0].ok, second.rows[0].ok]).toEqual([true, false]);
      await db.query("select public.complete_stripe_event($1)", [id]);
      const third = await db.query(
        "select public.claim_stripe_event($1, 'account.updated', '{}') as ok",
        [id],
      );
      expect(third.rows[0].ok).toBe(false);
    });
  });

  it("同時に届いても1つだけが処理する", async () => {
    const id = `evt_${uid()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        asSuperuser((db) =>
          db.query("select public.claim_stripe_event($1, 't', '{}') as ok", [id]),
        ),
      ),
    );
    expect(results.filter((r) => r.rows[0].ok)).toHaveLength(1);
  });

  it("処理に失敗したイベントは、処理中の期限が過ぎたあとの再送で処理し直せる", async () => {
    const id = `evt_${uid()}`;
    await asSuperuser(async (db) => {
      await db.query("select public.claim_stripe_event($1, 't', '{}')", [id]);
      await db.query("select public.complete_stripe_event($1, 'boom')", [id]);
      const retry = await db.query("select public.claim_stripe_event($1, 't', '{}') as ok", [id]);
      expect(retry.rows[0].ok).toBe(true);
      const row = await db.query("select attempts from public.stripe_events where event_id = $1", [
        id,
      ]);
      expect(row.rows[0].attempts).toBe(2);
    });
  });

  it("ブラウザからは呼べない", async () => {
    await as(anon, async (db) => {
      await expectError(db, "select public.claim_stripe_event('evt_x', 't', '{}')");
    });
  });
});

describe("スペースの管理", () => {
  it("写真は5枚まで。パスはスペースのフォルダ", async () => {
    const h = await createHostWithSpace();
    await as(user(h.memberId), async (db) => {
      for (let i = 0; i < 5; i++) {
        await db.query(
          "insert into public.space_photos (space_id, storage_path, sort_order) values ($1, $2, $3)",
          [h.spaceId, `${h.spaceId}/${i}.jpg`, i],
        );
      }
      expect(
        await expectError(
          db,
          "insert into public.space_photos (space_id, storage_path) values ($1, $2)",
          [h.spaceId, `${h.spaceId}/6.jpg`],
        ),
      ).toMatch(/too_many_photos/);
    });
    await as(user(h.memberId), async (db) => {
      expect(
        await expectError(
          db,
          "insert into public.space_photos (space_id, storage_path) values ($1, $2)",
          [h.spaceId, `other/1.jpg`],
        ),
      ).toMatch(/invalid_path/);
    });
  });

  it("営業時間はまとめて置き換え、重なりは受け付けない。他社のスペースは変えられない", async () => {
    const h = await createHostWithSpace();
    const other = await createHostWithSpace();
    await as(user(h.memberId), async (db) => {
      await db.query("select public.replace_availability_rules($1, $2)", [
        h.spaceId,
        JSON.stringify([
          { weekday: 1, open_time: "09:00", close_time: "12:00" },
          { weekday: 1, open_time: "13:00", close_time: "18:00" },
        ]),
      ]);
      const { rows } = await db.query(
        "select count(*)::int as n from public.availability_rules where space_id = $1",
        [h.spaceId],
      );
      expect(rows[0].n).toBe(2);
      expect(
        await expectError(db, "select public.replace_availability_rules($1, $2)", [
          h.spaceId,
          JSON.stringify([
            { weekday: 1, open_time: "09:00", close_time: "12:00" },
            { weekday: 1, open_time: "11:00", close_time: "18:00" },
          ]),
        ]),
      ).toMatch(/overlapping_rules/);
      expect(
        await expectError(db, "select public.replace_availability_rules($1, $2)", [
          h.spaceId,
          JSON.stringify([{ weekday: 1, open_time: "09:15", close_time: "12:00" }]),
        ]),
      ).toMatch(/check constraint/);
      expect(
        await expectError(db, "select public.replace_availability_rules($1, '[]')", [
          other.spaceId,
        ]),
      ).toMatch(/not_allowed/);
    });
  });

  it("これからの予約があるスペースは削除できない", async () => {
    const h = await createHostWithSpace();
    const guest = await createUser();
    await asSuperuser((db) =>
      createOrderWithBooking(db, {
        guestId: guest,
        hostId: h.hostId,
        spaceId: h.spaceId,
        period: "[2099-01-01 10:00+09, 2099-01-01 11:00+09)",
        status: "confirmed",
      }),
    );
    await as(user(h.memberId), async (db) => {
      expect(
        await expectError(db, "update public.spaces set deleted_at = now() where id = $1", [
          h.spaceId,
        ]),
      ).toMatch(/space_has_upcoming_bookings/);
    });
    const empty = await createHostWithSpace();
    await as(user(empty.memberId), async (db) => {
      await db.query("update public.spaces set deleted_at = now() where id = $1", [empty.spaceId]);
      const { rows } = await db.query("select status from public.spaces where id = $1", [
        empty.spaceId,
      ]);
      expect(rows[0].status).toBe("draft");
    });
  });
});

describe("space_busy_periods", () => {
  it("公開中のスペースは未ログインでも予約済みの期間だけを取得できる（誰の予約かは返さない）", async () => {
    const h = await createHostWithSpace();
    const guest = await createUser();
    await asSuperuser((db) =>
      createOrderWithBooking(db, {
        guestId: guest,
        hostId: h.hostId,
        spaceId: h.spaceId,
        period: "[2026-12-01 10:00+09, 2026-12-01 11:30+09)",
      }),
    );
    await as(anon, async (db) => {
      const { rows, fields } = await db.query(
        "select * from public.space_busy_periods($1, '2026-12-01 00:00+09', '2026-12-02 00:00+09')",
        [h.spaceId],
      );
      expect(fields.map((f) => f.name)).toEqual(["period_start", "period_end"]);
      expect(rows).toHaveLength(1);
      expect(new Date(rows[0].period_start).toISOString()).toBe("2026-12-01T01:00:00.000Z");
      await expectError(
        db,
        "select * from public.space_busy_periods($1, '2026-12-01 00:00+09', '2027-03-01 00:00+09')",
        [h.spaceId],
      );
    });
  });

  it("非公開のスペースは貸出主以外は取得できない", async () => {
    const draft = await createHostWithSpace({ ready: false });
    await as(anon, async (db) => {
      expect(
        await expectError(
          db,
          "select * from public.space_busy_periods($1, now(), now() + interval '1 day')",
          [draft.spaceId],
        ),
      ).toMatch(/not_allowed/);
    });
    await as(user(draft.memberId), async (db) => {
      await db.query(
        "select * from public.space_busy_periods($1, now(), now() + interval '1 day')",
        [draft.spaceId],
      );
    });
  });

  it("public_hosts は active な貸出主の会社名だけを出す", async () => {
    const h = await createHostWithSpace();
    const draft = await createHostWithSpace({ ready: false });
    await as(anon, async (db) => {
      const { rows, fields } = await db.query(
        "select * from public.public_hosts where id = any($1)",
        [[h.hostId, draft.hostId]],
      );
      expect(fields.map((f) => f.name)).toEqual(["id", "company_name"]);
      expect(rows.map((r) => r.id)).toEqual([h.hostId]);
    });
  });
});
