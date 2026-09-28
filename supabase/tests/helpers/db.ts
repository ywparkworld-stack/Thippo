import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll } from "vitest";

export type Db = pg.PoolClient;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.THIPPO_TEST_DB_URL;
    if (!connectionString)
      throw new Error("THIPPO_TEST_DB_URL is not set (global setup did not run)");
    pool = new pg.Pool({ connectionString, max: 10 });
  }
  return pool;
}

afterAll(async () => {
  await pool?.end();
  pool = null;
});

/** postgres（RLS を無視できる運用者）として実行する。 */
export async function asSuperuser<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export interface Actor {
  id: string | null;
  role: "anon" | "authenticated" | "service_role";
  aal?: "aal1" | "aal2";
}

/**
 * PostgREST と同じく、トランザクションの中でロールと JWT のクレームを設定して実行する。
 * 最後にロールバックするので、書き込みはほかのテストに残らない。
 */
export async function as<T>(actor: Actor, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const claims = { sub: actor.id ?? undefined, role: actor.role, aal: actor.aal ?? "aal1" };
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
    await client.query(`set local role ${actor.role}`);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

export const anon: Actor = { id: null, role: "anon" };
export const serviceRole: Actor = { id: null, role: "service_role" };
export const user = (id: string, aal: "aal1" | "aal2" = "aal1"): Actor => ({
  id,
  role: "authenticated",
  aal,
});

/** SQL の実行が権限・制約で失敗することを確かめる。失敗した文だけをセーブポイントで取り消す。 */
export async function expectError(db: Db, sql: string, params: unknown[] = []): Promise<string> {
  await db.query("savepoint expect_error");
  try {
    await db.query(sql, params);
  } catch (e) {
    await db.query("rollback to savepoint expect_error");
    return (e as Error).message;
  }
  await db.query("release savepoint expect_error");
  throw new Error(`expected SQL to fail: ${sql}`);
}

export const uid = () => randomUUID();
