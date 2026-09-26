import { beforeEach, describe, expect, it } from "vitest";
import { as, asSuperuser, expectError, uid, user, type Db } from "./helpers/db";
import { createUser } from "./helpers/fixtures";

let guest: string;
let adminId: string;

beforeEach(async () => {
  guest = await createUser("guest");
  adminId = adminId ?? (await createUser("admin"));
});

/** ブラウザからのアップロードの代わりに、ストレージのオブジェクトを作る */
async function upload(db: Db, owner: string, name = `${owner}/${uid()}.jpg`): Promise<string> {
  await db.query(
    "insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)",
    [name, owner],
  );
  return name;
}

async function submit(db: Db, type: string, front: string, back: string | null = null) {
  const { rows } = await db.query("select public.submit_identity_document($1, $2, $3) as id", [
    type,
    front,
    back,
  ]);
  return rows[0].id as string;
}

async function status(userId: string) {
  const { rows } = await asSuperuser((db) =>
    db.query("select identity_status from public.profiles where id = $1", [userId]),
  );
  return rows[0].identity_status;
}

async function submitCommitted(
  userId: string,
  type = "drivers_license",
  withBack = false,
): Promise<string> {
  // as() はロールバックするため、審査のテスト用には postgres でコミットしたうえで JWT を設定して呼ぶ
  return asSuperuser(async (db) => {
    await db.query("begin");
    const front = await upload(db, userId);
    const back = withBack ? await upload(db, userId) : null;
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await db.query("set local role authenticated");
    const id = await submit(db, type, front, back);
    await db.query("commit");
    return id;
  });
}

describe("submit_identity_document", () => {
  it("表面だけで提出でき、状態が審査中になる", async () => {
    const id = await submitCommitted(guest);
    expect(id).toBeTruthy();
    expect(await status(guest)).toBe("pending");
  });

  it("審査中・承認済みのときは提出できない", async () => {
    await submitCommitted(guest);
    await as(user(guest), async (db) => {
      const front = await upload(db, guest);
      expect(
        await expectError(db, "select public.submit_identity_document('passport', $1)", [front]),
      ).toMatch(/identity_already_pending/);
    });
  });

  it("他人のフォルダのファイルや、アップロードしていないファイルは提出できない", async () => {
    const other = await createUser("guest");
    await as(user(guest), async (db) => {
      const othersFile = await asSuperuser((s) => upload(s, other));
      expect(
        await expectError(db, "select public.submit_identity_document('passport', $1)", [
          othersFile,
        ]),
      ).toMatch(/invalid_path/);
      expect(
        await expectError(db, "select public.submit_identity_document('passport', $1)", [
          `${guest}/missing.jpg`,
        ]),
      ).toMatch(/file_not_found/);
    });
  });

  it("マイナンバーカードの裏面は受け付けない", async () => {
    await as(user(guest), async (db) => {
      const front = await upload(db, guest);
      const back = await upload(db, guest);
      expect(
        await expectError(db, "select public.submit_identity_document('my_number_card', $1, $2)", [
          front,
          back,
        ]),
      ).toMatch(/my_number_back_not_allowed/);
    });
  });

  it("貸出主・運営は提出できない", async () => {
    const host = await createUser("host");
    // 貸出主はそもそも本人確認書類のバケットにアップロードできない（ストレージのポリシー）
    await as(user(host), async (db) => {
      await expectError(
        db,
        "insert into storage.objects (bucket_id, name, owner) values ('identity-documents', $1, $2)",
        [`${host}/x.jpg`, host],
      );
    });
    const front = await asSuperuser((db) => upload(db, host));
    await as(user(host), async (db) => {
      expect(
        await expectError(db, "select public.submit_identity_document('passport', $1)", [front]),
      ).toMatch(/not_allowed/);
    });
  });
});

describe("提出後のファイル", () => {
  it("利用者は提出したファイルを差し替え・削除できない", async () => {
    await submitCommitted(guest);
    await as(user(guest), async (db) => {
      const upd = await db.query(
        "update storage.objects set name = name || '.x' where bucket_id = 'identity-documents' and owner = $1",
        [guest],
      );
      expect(upd.rowCount).toBe(0);
      const del = await db.query(
        "delete from storage.objects where bucket_id = 'identity-documents' and owner = $1",
        [guest],
      );
      expect(del.rowCount).toBe(0);
    });
  });
});

describe("review_identity_document", () => {
  it("aal2 の admin が承認すると承認済みになり、操作ログが残る", async () => {
    const docId = await submitCommitted(guest);
    await as(user(adminId, "aal2"), async (db) => {
      await db.query("select public.review_identity_document($1, true)", [docId]);
      const { rows } = await db.query(
        "select status, reviewed_by from public.identity_documents where id = $1",
        [docId],
      );
      expect(rows[0]).toEqual({ status: "approved", reviewed_by: adminId });
      const p = await db.query("select identity_status from public.profiles where id = $1", [
        guest,
      ]);
      expect(p.rows[0].identity_status).toBe("approved");
      const log = await db.query(
        "select actor_id, action, payload from public.audit_logs where target_id = $1",
        [docId],
      );
      expect(log.rows).toHaveLength(1);
      expect(log.rows[0]).toMatchObject({ actor_id: adminId, action: "identity.approve" });
      expect(log.rows[0].payload).toMatchObject({ user_id: guest, aal: "aal2" });
    });
  });

  it("却下には理由が必要。両面の提出を求めると、次は裏面がないと提出できない。何度でも再提出できる", async () => {
    const docId = await submitCommitted(guest);
    await asSuperuser(async (db) => {
      await db.query("begin");
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: adminId, role: "authenticated", aal: "aal2" }),
      ]);
      await db.query("set local role authenticated");
      expect(
        await expectError(db, "select public.review_identity_document($1, false, '  ')", [docId]),
      ).toMatch(/reject_reason_required/);
      await db.query(
        "select public.review_identity_document($1, false, '文字が読み取れません', true)",
        [docId],
      );
      await db.query("commit");
    });
    expect(await status(guest)).toBe("rejected");

    await as(user(guest), async (db) => {
      const front = await upload(db, guest);
      expect(
        await expectError(db, "select public.submit_identity_document('passport', $1)", [front]),
      ).toMatch(/back_side_required/);
      const back = await upload(db, guest);
      // マイナンバーカードは裏面を出せないため、両面を求められたら別の書類になる
      expect(
        await expectError(db, "select public.submit_identity_document('my_number_card', $1, $2)", [
          front,
          back,
        ]),
      ).toMatch(/my_number_back_not_allowed/);
      await db.query("select public.submit_identity_document('drivers_license', $1, $2)", [
        front,
        back,
      ]);
      const p = await db.query("select identity_status from public.profiles where id = $1", [
        guest,
      ]);
      expect(p.rows[0].identity_status).toBe("pending");
    });

    const log = await asSuperuser((db) =>
      db.query("select action, payload from public.audit_logs where target_id = $1", [docId]),
    );
    expect(log.rows[0]).toMatchObject({
      action: "identity.reject",
      payload: { reject_reason: "文字が読み取れません", back_side_requested: true },
    });
  });

  it("審査済みの書類はもう一度審査できない", async () => {
    const docId = await submitCommitted(guest);
    await asSuperuser((db) =>
      db.query(
        "update public.identity_documents set status = 'approved', reviewed_by = $2, reviewed_at = now() where id = $1",
        [docId, adminId],
      ),
    );
    await as(user(adminId, "aal2"), async (db) => {
      expect(
        await expectError(db, "select public.review_identity_document($1, false, 'x')", [docId]),
      ).toMatch(/document_not_pending/);
    });
  });

  it("aal1 の admin・利用者・貸出主は審査できない", async () => {
    const docId = await submitCommitted(guest);
    const host = await createUser("host");
    for (const actor of [user(adminId, "aal1"), user(guest), user(host, "aal2")]) {
      await as(actor, async (db) => {
        expect(
          await expectError(db, "select public.review_identity_document($1, true)", [docId]),
        ).toMatch(/not_allowed/);
      });
    }
    expect(await status(guest)).toBe("pending");
  });
});
