import { asSuperuser, uid, type Db } from "./db";

/** テスト用のデータを postgres として作る（コミットされる。ID は毎回ランダム）。 */

export async function createUser(
  role: "guest" | "host" | "admin" = "guest",
  db?: Db,
): Promise<string> {
  const run = async (c: Db) => {
    const id = uid();
    await c.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@example.test`]);
    if (role !== "guest")
      await c.query("update public.profiles set role = $2 where id = $1", [id, role]);
    return id;
  };
  return db ? run(db) : asSuperuser(run);
}

export interface HostFixture {
  hostId: string;
  memberId: string;
  spaceId: string;
}

export async function createHostWithSpace(
  opts: { ready?: boolean; price?: number } = {},
): Promise<HostFixture> {
  const { ready = true, price = 1000 } = opts;
  return asSuperuser(async (db) => {
    const memberId = await createUser("host", db);
    const hostId = uid();
    await db.query(
      `insert into public.hosts (id, company_name, status, stripe_account_id, charges_enabled, payouts_enabled)
       values ($1, 'テスト株式会社', $2, $3, $4, $4)`,
      [hostId, ready ? "active" : "applied", `acct_${hostId.slice(0, 8)}`, ready],
    );
    await db.query("insert into public.host_members (host_id, user_id) values ($1, $2)", [
      hostId,
      memberId,
    ]);
    const spaceId = uid();
    await db.query(
      `insert into public.spaces (id, host_id, name, address, area, capacity, price_per_30min, status)
       values ($1, $2, '会議室A', '東京都千代田区1-1', '丸の内', 8, $3, $4)`,
      [spaceId, hostId, price, ready ? "published" : "draft"],
    );
    return { hostId, memberId, spaceId };
  });
}

/** pending の注文と予約を作る。period は '[2026-10-01 10:00+09, 2026-10-01 11:00+09)' の形式。 */
export async function createOrderWithBooking(
  db: Db,
  input: {
    guestId: string;
    hostId: string;
    spaceId: string;
    period: string;
    price?: number;
    status?: string;
  },
): Promise<{ orderId: string; bookingId: string }> {
  const price = input.price ?? 1000;
  const orderId = uid();
  const bookingId = uid();
  const { rows } = await db.query<{ slots: number }>(
    "select (extract(epoch from (upper($1::tstzrange) - lower($1::tstzrange))) / 1800)::int as slots",
    [input.period],
  );
  const slots = rows[0]!.slots;
  await db.query(
    `insert into public.orders (id, guest_id, host_id, total, application_fee_amount, expires_at)
     values ($1, $2, $3, $4, 0, now() + interval '15 minutes')`,
    [orderId, input.guestId, input.hostId, price * slots],
  );
  await db.query(
    `insert into public.bookings (id, order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      bookingId,
      orderId,
      input.spaceId,
      input.guestId,
      input.hostId,
      input.period,
      slots,
      price,
      price * slots,
      input.status ?? "pending",
    ],
  );
  return { orderId, bookingId };
}
