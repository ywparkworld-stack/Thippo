import { randomUUID } from "node:crypto";
import type pg from "pg";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { withDb } from "./db";
import { env } from "./env";

/**
 * テスト用のデータを DB に直接作る（supabase start のデータベース。postgres ロール）。
 * - 運営のアカウント（admin ロールは DB でしか付与できない。docs/admin-access.md と同じ手順）
 * - Stripe のテストモードの連結アカウントを持つ貸出主と、公開中のスペース（毎日 0:00〜24:00 営業）
 * 貸出主の Stripe Connect のオンボーディングは画面を自動で操作できないため、登録済みのアカウントを使う。
 */
/** メールアドレスとパスワードでログインするための auth.identities の行（Supabase Auth が必要とする） */
async function addEmailIdentity(db: pg.Client, email: string) {
  await db.query(
    `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now()
     from auth.users u
     where u.email = $1 and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')`,
    [email],
  );
}

export default async function globalSetup() {
  if (!env.connectedAccountId) throw new Error("STRIPE_TEST_CONNECTED_ACCOUNT_ID is required");
  const spaceName = `E2E会議室 ${randomUUID().slice(0, 6)}`;
  await withDb(async (db) => {
    // 運営
    await db.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
              extensions.crypt($2, extensions.gen_salt('bf')), now(), now(), now(),
              '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''
       where not exists (select 1 from auth.users where email = $1)`,
      [env.adminEmail, env.adminPassword],
    );
    await db.query(
      "update public.profiles set role = 'admin', status = 'active' where email = $1",
      [env.adminEmail],
    );
    await db.query(
      "delete from auth.mfa_factors where user_id = (select id from auth.users where email = $1)",
      [env.adminEmail],
    );

    // 貸出主とスペース
    const hostMember = randomUUID();
    await db.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
               extensions.crypt('E2eHostPass123', extensions.gen_salt('bf')), now(), now(), now(),
               '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')`,
      [hostMember, `e2e-host-${hostMember.slice(0, 8)}@example.test`],
    );
    await addEmailIdentity(db, `e2e-host-${hostMember.slice(0, 8)}@example.test`);
    await db.query("update public.profiles set role = 'host' where id = $1", [hostMember]);
    const { rows } = await db.query(
      `insert into public.hosts (company_name, status, stripe_account_id, charges_enabled, payouts_enabled, details_submitted)
       values ('E2E株式会社', 'active', $1, true, true, true)
       on conflict (stripe_account_id) do update set status = 'active'
       returning id`,
      [env.connectedAccountId],
    );
    const hostId = rows[0].id as string;
    await db.query(
      "insert into public.host_members (host_id, user_id) values ($1, $2) on conflict do nothing",
      [hostId, hostMember],
    );
    const space = await db.query(
      `insert into public.spaces (host_id, name, address, area, capacity, price_per_30min, min_slots)
       values ($1, $2, '東京都千代田区1-1', 'E2Eエリア', 6, 1000, 1) returning id`,
      [hostId, spaceName],
    );
    const spaceId = space.rows[0].id as string;
    for (let wd = 0; wd < 7; wd++) {
      await db.query(
        "insert into public.availability_rules (space_id, weekday, open_time, close_time) values ($1, $2, '00:00', '24:00')",
        [spaceId, wd],
      );
    }
    await db.query("update public.spaces set status = 'published' where id = $1", [spaceId]);
    writeFileSync(
      join(import.meta.dirname, "..", ".e2e-state.json"),
      JSON.stringify({ spaceId, spaceName, hostId }),
    );
  });
}
