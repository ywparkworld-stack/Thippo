import { describe, expect, it } from "vitest";
import { asSuperuser, uid } from "./helpers/db";
import { createHostWithSpace, createUser } from "./helpers/fixtures";

async function booking(opts: {
  startSql: string;
  minutes?: number;
  paidSql?: string;
  status?: string;
}) {
  const h = await createHostWithSpace();
  const guestId = await createUser();
  const orderId = uid();
  const bookingId = uid();
  const minutes = opts.minutes ?? 60;
  await asSuperuser(async (db) => {
    await db.query(
      `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, status, paid_at, expires_at)
       values ($1, $2, $3, 2000, 292, 'paid', ${opts.paidSql ?? "now() - interval '3 days'"}, now())`,
      [orderId, guestId, h.hostId],
    );
    await db.query(
      `insert into public.bookings (id, order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status)
       values ($1, $2, $3, $4, $5, tstzrange(${opts.startSql}, ${opts.startSql} + $6 * interval '1 minute', '[)'), $7, 1000, $8, $9)`,
      [
        bookingId,
        orderId,
        h.spaceId,
        guestId,
        h.hostId,
        minutes,
        minutes / 30,
        (minutes / 30) * 1000,
        opts.status ?? "confirmed",
      ],
    );
  });
  return bookingId;
}

// 30分刻みに揃えた時刻の SQL
const aligned = (offset: string) =>
  `(to_timestamp(ceil(extract(epoch from now() + interval '${offset}') / 1800) * 1800))`;

describe("定期実行", () => {
  it("利用終了時刻を過ぎた confirmed の予約を completed にする", async () => {
    const past = await booking({ startSql: `(${aligned("-4 hours")})` });
    const future = await booking({ startSql: `(${aligned("1 day")})` });
    await asSuperuser(async (db) => {
      await db.query("select public.complete_finished_bookings()");
      const { rows } = await db.query("select id, status from public.bookings where id = any($1)", [
        [past, future],
      ]);
      expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({
        [past]: "completed",
        [future]: "confirmed",
      });
    });
  });

  it("前日のリマインドは、その日に始まる予約を一度だけ返す", async () => {
    const id = await booking({ startSql: `('2031-05-10 10:00+09'::timestamptz)` });
    await asSuperuser(async (db) => {
      const first = await db.query(
        "select booking_id from public.claim_day_before_reminders('2031-05-10')",
      );
      expect(first.rows.map((r) => r.booking_id)).toContain(id);
      const second = await db.query(
        "select booking_id from public.claim_day_before_reminders('2031-05-10')",
      );
      expect(second.rows.map((r) => r.booking_id)).not.toContain(id);
    });
  });

  it("2時間前のリマインドは、開始まで2時間を切った予約だけ。2時間前を過ぎてから支払われた予約は除く", async () => {
    const soon = await booking({ startSql: `(${aligned("90 minutes")})` });
    const later = await booking({ startSql: `(${aligned("5 hours")})` });
    const lateBooked = await booking({ startSql: `(${aligned("90 minutes")})`, paidSql: "now()" });
    await asSuperuser(async (db) => {
      const { rows } = await db.query("select booking_id from public.claim_two_hour_reminders()");
      const ids = rows.map((r) => r.booking_id);
      expect(ids).toContain(soon);
      expect(ids).not.toContain(later);
      expect(ids).not.toContain(lateBooked);
      const again = await db.query("select booking_id from public.claim_two_hour_reminders()");
      expect(again.rows.map((r) => r.booking_id)).not.toContain(soon);
    });
  });

  it("提出に使われていない古い本人確認のファイルを見つける", async () => {
    const guest = await createUser();
    await asSuperuser(async (db) => {
      await db.query(
        "insert into storage.objects (bucket_id, name, owner, created_at) values ('identity-documents', $1, $2, now() - interval '2 days')",
        [`${guest}/orphan.jpg`, guest],
      );
      await db.query(
        "insert into storage.objects (bucket_id, name, owner, created_at) values ('identity-documents', $1, $2, now() - interval '2 days')",
        [`${guest}/used.jpg`, guest],
      );
      await db.query(
        "insert into public.identity_documents (user_id, front_path, document_type) values ($1, $2, 'passport')",
        [guest, `${guest}/used.jpg`],
      );
      const { rows } = await db.query("select name from public.orphan_identity_files()");
      const names = rows.map((r) => r.name);
      expect(names).toContain(`${guest}/orphan.jpg`);
      expect(names).not.toContain(`${guest}/used.jpg`);
    });
  });

  it("退会から保存期間を過ぎた利用者の書類だけを削除の対象にする", async () => {
    const withdrawn = await createUser();
    const active = await createUser();
    await asSuperuser(async (db) => {
      await db.query(
        "update public.profiles set withdrawn_at = now() - interval '400 days' where id = $1",
        [withdrawn],
      );
      for (const u of [withdrawn, active]) {
        await db.query(
          "insert into public.identity_documents (user_id, front_path, document_type) values ($1, $2, 'passport')",
          [u, `${u}/doc.jpg`],
        );
      }
      const { rows } = await db.query(
        "select document_id, front_path from public.identity_documents_due_for_purge(365)",
      );
      const paths = rows.map((r) => r.front_path);
      expect(paths).toContain(`${withdrawn}/doc.jpg`);
      expect(paths).not.toContain(`${active}/doc.jpg`);
      await db.query("select public.mark_identity_documents_purged($1)", [
        rows.map((r) => r.document_id),
      ]);
      const again = await db.query(
        "select count(*)::int as n from public.identity_documents_due_for_purge(365) where front_path = $1",
        [`${withdrawn}/doc.jpg`],
      );
      expect(again.rows[0].n).toBe(0);
    });
  });
});
