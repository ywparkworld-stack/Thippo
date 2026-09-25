import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * テスト用のデータベースを用意する。
 *
 * - SUPABASE_DB_URL がある場合: `supabase start` / `supabase db reset` 済みの本物の Supabase を使う。
 * - ない場合: TEST_PG_URL（既定 postgres://postgres@localhost:54329/postgres）の PostgreSQL に
 *   thippo_test データベースを作り直し、Supabase の最小限の再現（shim）とマイグレーションを適用する。
 */
const root = join(import.meta.dirname, "..", "..");

export default async function setup() {
  if (process.env.SUPABASE_DB_URL) {
    process.env.THIPPO_TEST_DB_URL = process.env.SUPABASE_DB_URL;
    return;
  }

  const adminUrl = process.env.TEST_PG_URL ?? "postgres://postgres@localhost:54329/postgres";
  const dbName = "thippo_test";
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(readFileSync(join(root, "tests", "shim", "supabase-shim.sql"), "utf8"));
    const migrations = readdirSync(join(root, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      try {
        await client.query(readFileSync(join(root, "migrations", file), "utf8"));
      } catch (e) {
        throw new Error(`migration ${file} failed: ${(e as Error).message}`, { cause: e });
      }
    }
  } finally {
    await client.end();
  }
  process.env.THIPPO_TEST_DB_URL = url.toString();
}
