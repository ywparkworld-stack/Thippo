-- thippo のデータベースの設定（supabase/migrations のファイルを順番どおりにまとめたもの）
-- 自動生成：pnpm db:bundle。直接編集しない。
-- 新しい Supabase プロジェクトの SQL Editor に全部貼り付けて「Run」を1回押す（docs/manual-setup.md）。

-- ===== 20260925000100_foundation.sql =====
-- thippo: 拡張機能・スキーマ・型・共通の関数
-- SPEC §4

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- RLS から呼ぶ補助関数や内部用のテーブルは、API（PostgREST）に公開しない private スキーマに置く。
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 列挙型
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('guest', 'host', 'admin');
create type public.identity_status as enum ('unsubmitted', 'pending', 'approved', 'rejected');
create type public.account_status as enum ('active', 'suspended');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.host_status as enum ('applied', 'active', 'suspended');
create type public.space_status as enum ('draft', 'published', 'suspended');
create type public.order_status as enum ('pending', 'paid', 'expired', 'failed');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.cancel_actor as enum ('guest', 'host', 'admin');
create type public.cancel_policy as enum ('full', 'half', 'none');
create type public.refund_status as enum ('pending', 'succeeded', 'failed');
create type public.notification_status as enum ('queued', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- 共通のトリガー関数
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- API 経由（anon / authenticated）のリクエストかどうか。
-- security definer の関数やサーバー（service_role）、DB を直接操作する運用者からの変更は false。
create or replace function private.is_api_user() returns boolean
language sql stable as $$
  select current_user in ('anon', 'authenticated')
$$;

-- ===== 20260925000200_tables.sql =====
-- thippo: テーブル
-- SPEC §4。削除は論理削除（deleted_at）を基本とする。
-- 金額はすべて integer（円）。日時はすべて timestamptz。

-- ---------------------------------------------------------------------------
-- 会員
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id),
  role public.user_role not null default 'guest',
  display_name text check (char_length(display_name) <= 100),
  email text not null,
  phone text check (char_length(phone) <= 30),
  identity_status public.identity_status not null default 'unsubmitted',
  status public.account_status not null default 'active',
  withdrawn_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

create table public.identity_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  storage_path text not null unique,
  status public.review_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  reject_reason text check (char_length(reject_reason) <= 1000),
  -- 保存期間を過ぎてストレージから削除した日時（SPEC §3.3）
  purged_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 利用者は自分のフォルダ（<user_id>/...）にだけ置ける
  constraint identity_documents_path_owner check (split_part(storage_path, '/', 1) = user_id::text),
  constraint identity_documents_review_consistency check (
    (status = 'pending' and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  ),
  constraint identity_documents_reject_reason check (status <> 'rejected' or reject_reason is not null)
);
create index identity_documents_user_idx on public.identity_documents (user_id, submitted_at desc);
create index identity_documents_pending_idx on public.identity_documents (submitted_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- 貸出主
-- ---------------------------------------------------------------------------
create table public.host_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 1 and 200),
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 30),
  address text not null check (char_length(address) <= 300),
  note text check (char_length(note) <= 2000),
  status public.review_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  reject_reason text check (char_length(reject_reason) <= 1000),
  host_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index host_applications_pending_idx on public.host_applications (created_at) where status = 'pending';

create table public.hosts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 1 and 200),
  -- 適格請求書発行事業者の登録番号: T + 13桁
  invoice_registration_number text check (invoice_registration_number ~ '^T[0-9]{13}$'),
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 30),
  status public.host_status not null default 'applied',
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  application_id uuid references public.host_applications (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.host_applications
  add constraint host_applications_host_fk foreign key (host_id) references public.hosts (id);

create table public.host_members (
  host_id uuid not null references public.hosts (id),
  user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (host_id, user_id)
);
create index host_members_user_idx on public.host_members (user_id);

-- ---------------------------------------------------------------------------
-- スペース
-- ---------------------------------------------------------------------------
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  address text not null check (char_length(address) <= 300),
  -- 検索に使うエリア名（例: 渋谷、丸の内）
  area text not null check (char_length(area) <= 100),
  capacity integer not null check (capacity between 1 and 1000),
  amenities text[] not null default '{}',
  price_per_30min integer not null check (price_per_30min > 0),
  min_slots integer not null default 1 check (min_slots between 1 and 48),
  status public.space_status not null default 'draft',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, host_id)
);
create index spaces_host_idx on public.spaces (host_id);
create index spaces_published_idx on public.spaces (area) where status = 'published' and deleted_at is null;

create table public.space_photos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id),
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index space_photos_space_idx on public.space_photos (space_id, sort_order);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id),
  -- 0 = 日曜 … 6 = 土曜（東京時間）
  weekday smallint not null check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now(),
  check (open_time < close_time),
  check (extract(minute from open_time)::int % 30 = 0 and extract(second from open_time) = 0),
  check (extract(minute from close_time)::int % 30 = 0 and extract(second from close_time) = 0)
);
create index availability_rules_space_idx on public.availability_rules (space_id, weekday);

create table public.closures (
  space_id uuid not null references public.spaces (id),
  date date not null,
  created_at timestamptz not null default now(),
  primary key (space_id, date)
);

-- ---------------------------------------------------------------------------
-- 予約カゴ（ログイン中の利用者のみ。未ログインの間はブラウザに保持する）
-- ---------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  space_id uuid not null references public.spaces (id),
  period tstzrange not null,
  created_at timestamptz not null default now(),
  constraint cart_items_period_bounds check (
    not isempty(period) and lower_inc(period) and not upper_inc(period)
    and not lower_inf(period) and not upper_inf(period)
  ),
  constraint cart_items_period_30min check (
    (extract(epoch from lower(period))::bigint % 1800) = 0
    and (extract(epoch from upper(period))::bigint % 1800) = 0
  )
);
create index cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- 注文・予約
-- ---------------------------------------------------------------------------
create sequence private.order_number_seq;
grant usage on sequence private.order_number_seq to service_role;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- 画面・メールに表示する注文番号。推測しにくい id とは別の連番。
  order_number text not null unique
    default ('T-' || lpad(nextval('private.order_number_seq')::text, 8, '0')),
  guest_id uuid not null references public.profiles (id),
  host_id uuid not null references public.hosts (id),
  total integer not null check (total > 0),
  application_fee_amount integer not null check (application_fee_amount >= 0),
  status public.order_status not null default 'pending',
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  stripe_transfer_id text unique,
  -- balance_transaction から取得した実際の Stripe 手数料（SPEC §5）
  stripe_fee_actual integer check (stripe_fee_actual >= 0),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (application_fee_amount <= total),
  check (status <> 'paid' or paid_at is not null),
  unique (id, guest_id, host_id)
);
create index orders_guest_idx on public.orders (guest_id, created_at desc);
create index orders_host_idx on public.orders (host_id, created_at desc);
create index orders_pending_idx on public.orders (expires_at) where status = 'pending';

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  space_id uuid not null,
  guest_id uuid not null,
  host_id uuid not null,
  period tstzrange not null,
  slots integer not null check (slots between 1 and 48),
  -- 予約時点の 30 分あたり料金（料金を変更しても確定済みの予約の金額は変わらない）
  price_per_30min integer not null check (price_per_30min > 0),
  total integer not null,
  status public.booking_status not null default 'pending',
  cancelled_by public.cancel_actor,
  cancelled_at timestamptz,
  cancel_policy public.cancel_policy,
  cancel_reason text check (char_length(cancel_reason) <= 1000),
  no_show_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 注文・スペースと利用者・貸出主が食い違わないようにする
  foreign key (order_id, guest_id, host_id) references public.orders (id, guest_id, host_id),
  foreign key (space_id, host_id) references public.spaces (id, host_id),

  constraint bookings_period_bounds check (
    not isempty(period) and lower_inc(period) and not upper_inc(period)
    and not lower_inf(period) and not upper_inf(period)
  ),
  -- 開始と終了は 30 分刻み（SPEC §4.1）
  constraint bookings_period_30min check (
    (extract(epoch from lower(period))::bigint % 1800) = 0
    and (extract(epoch from upper(period))::bigint % 1800) = 0
  ),
  constraint bookings_slots_match_period check (
    slots = (extract(epoch from (upper(period) - lower(period)))::bigint / 1800)
  ),
  constraint bookings_total_match check (total = price_per_30min * slots),
  constraint bookings_cancel_consistency check (
    (status = 'cancelled') = (cancelled_by is not null and cancelled_at is not null and cancel_policy is not null)
  ),
  -- ダブルブッキングの防止（SPEC §4.1）
  constraint bookings_no_overlap exclude using gist (space_id with =, period with &&)
    where (status in ('pending', 'confirmed'))
);
create index bookings_order_idx on public.bookings (order_id);
create index bookings_guest_idx on public.bookings (guest_id, lower(period) desc);
create index bookings_host_idx on public.bookings (host_id, lower(period) desc);
create index bookings_confirmed_end_idx on public.bookings (upper(period)) where status = 'confirmed';

-- 予約1件ごとの料金内訳。確定時の値を保存し、料金改定後も変えない（SPEC §4, §5）。
create table public.booking_fees (
  booking_id uuid primary key references public.bookings (id),
  hours integer not null check (hours >= 1),
  platform_fee_excl_tax integer not null check (platform_fee_excl_tax >= 0),
  platform_fee_tax integer not null check (platform_fee_tax >= 0),
  stripe_fee_estimated integer not null check (stripe_fee_estimated >= 0),
  application_fee integer not null,
  created_at timestamptz not null default now(),
  check (application_fee = platform_fee_excl_tax + platform_fee_tax + stripe_fee_estimated)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  policy public.cancel_policy not null,
  refund_amount integer not null check (refund_amount >= 0),
  transfer_reversal_amount integer not null check (transfer_reversal_amount >= 0),
  -- キャンセル後に運営が受け取る手数料
  platform_fee_excl_tax integer not null check (platform_fee_excl_tax >= 0),
  platform_fee_tax integer not null check (platform_fee_tax >= 0),
  status public.refund_status not null default 'pending',
  stripe_refund_id text unique,
  stripe_transfer_reversal_id text unique,
  failure_reason text,
  attempts integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);
create index refunds_failed_idx on public.refunds (created_at) where status = 'failed';

-- 利用者自身のキャンセル。回数の判定に使う（SPEC §8, 付録 D3）。
create table public.cancel_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  booking_id uuid not null unique references public.bookings (id),
  created_at timestamptz not null default now()
);
create index cancel_events_user_time_idx on public.cancel_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 月次明細
-- ---------------------------------------------------------------------------
create table public.monthly_statements (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id),
  -- 対象月の1日（東京時間）
  month date not null check (extract(day from month) = 1),
  gross integer not null,
  platform_fee_excl_tax integer not null,
  platform_fee_tax integer not null,
  stripe_fee integer not null,
  net integer not null,
  pdf_path text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (host_id, month)
);

-- ---------------------------------------------------------------------------
-- 外部連携・記録
-- ---------------------------------------------------------------------------
-- Webhook の重複処理防止（SPEC §7-5）
create table public.stripe_events (
  event_id text primary key,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  to_email text not null,
  template text not null,
  subject text not null,
  status public.notification_status not null default 'queued',
  provider_message_id text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- 運営の操作記録（SPEC §3.2）。追記のみ。
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target_table text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'identity_documents', 'host_applications', 'hosts', 'spaces', 'carts',
    'orders', 'bookings', 'refunds', 'monthly_statements'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ===== 20260925000300_pricing.sql =====
-- thippo: 料金計算（DB 側）
-- packages/core/src/pricing.ts・minimum-price.ts と同じ計算。数値は private.pricing_config() にまとめ、
-- packages/core/src/config.ts と一致することを supabase/tests/pricing.test.ts で確かめる。
-- どちらかを変えたら、もう一方も必ず変えること。

create or replace function private.pricing_config() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'slotMinutes', 30,
    'consumptionTaxPercent', 10,
    'platformFeePerHourExclTax', 200,
    'halfCancelPlatformFeePerHourExclTax', 100,
    'stripeFeeRateNumerator', 36,
    'stripeFeeRateDenominator', 1000,
    'maxSlotsPerBooking', 48,
    'maxPricePer30min', 1000000,
    'maxAdvanceDays', 30,
    'pendingOrderTtlMinutes', 15,
    'fullRefundBeforeMinutes', 120,
    'cancelCountWindowHours', 24,
    'maxCancelsBeforeNoRefund', 5
  )
$$;

create or replace function private.cfg(key text) returns integer
language sql immutable as $$
  select (private.pricing_config() ->> key)::integer
$$;

-- 予約1件の料金内訳（core の calcBookingFees と同じ）
create type private.booking_fee_breakdown as (
  slots integer,
  hours integer,
  price_per_30min integer,
  subtotal integer,
  platform_fee_excl_tax integer,
  platform_fee_tax integer,
  stripe_fee_estimated integer,
  application_fee integer,
  host_payout integer
);

create or replace function private.calc_booking_fees(p_price integer, p_slots integer)
returns private.booking_fee_breakdown
language plpgsql immutable as $$
declare
  r private.booking_fee_breakdown;
begin
  if p_slots is null or p_slots < 1 or p_slots > private.cfg('maxSlotsPerBooking') then
    raise exception 'slots out of range: %', p_slots using errcode = '22023';
  end if;
  if p_price is null or p_price < 1 or p_price > private.cfg('maxPricePer30min') then
    raise exception 'price out of range: %', p_price using errcode = '22023';
  end if;
  r.slots := p_slots;
  r.hours := (p_slots + 1) / 2;
  r.price_per_30min := p_price;
  r.subtotal := p_price * p_slots;
  r.platform_fee_excl_tax := private.cfg('platformFeePerHourExclTax') * r.hours;
  r.platform_fee_tax := (r.platform_fee_excl_tax * private.cfg('consumptionTaxPercent')) / 100;
  -- ceil(subtotal × 36 / 1000)。整数の割り算だけで計算する。
  r.stripe_fee_estimated := (r.subtotal::bigint * private.cfg('stripeFeeRateNumerator')
    + private.cfg('stripeFeeRateDenominator') - 1) / private.cfg('stripeFeeRateDenominator');
  r.application_fee := r.platform_fee_excl_tax + r.platform_fee_tax + r.stripe_fee_estimated;
  r.host_payout := r.subtotal - r.application_fee;
  return r;
end
$$;

-- 半額返金・返金なしのどちらでも貸出主の手取りがマイナスにならないか（core の isHostNetNonNegative と同じ）
create or replace function private.is_host_net_non_negative(p_price integer, p_slots integer)
returns boolean
language plpgsql immutable as $$
declare
  f private.booking_fee_breakdown := private.calc_booking_fees(p_price, p_slots);
  half_refund integer := f.subtotal / 2;
  kept_excl integer := private.cfg('halfCancelPlatformFeePerHourExclTax') * f.hours;
  kept integer := kept_excl + (kept_excl * private.cfg('consumptionTaxPercent')) / 100;
  reversal integer := half_refund - kept;
begin
  return f.host_payout >= 0 and reversal >= 0 and reversal <= f.host_payout;
end
$$;

-- 最低利用枠数ごとの料金の下限（core の minimumPricePer30min と同じ）。
-- 計算に時間がかかるため表にしておき、設定を変えたら private.refresh_min_prices() を実行する。
create table private.min_price_by_min_slots (
  min_slots integer primary key,
  min_price integer not null
);

create or replace function private.refresh_min_prices() returns void
language plpgsql as $$
declare
  max_slots integer := private.cfg('maxSlotsPerBooking');
begin
  delete from private.min_price_by_min_slots;
  insert into private.min_price_by_min_slots (min_slots, min_price)
  with failures as (
    select s, coalesce(max(p) filter (where not private.is_host_net_non_negative(p, s)), 0) as last_failure
    from generate_series(1, max_slots) s
    cross join generate_series(1, 2000) p
    group by s
  )
  select m, (select max(last_failure) from failures where s >= m) + 1
  from generate_series(1, max_slots) m;
end
$$;

select private.refresh_min_prices();

create or replace function private.min_price_per_30min(p_min_slots integer) returns integer
language sql stable security definer set search_path = '' as $$
  select min_price from private.min_price_by_min_slots where min_slots = p_min_slots
$$;

-- 画面から下限を表示するために公開する（数値のみで秘密はない）
create or replace function public.min_price_per_30min(p_min_slots integer) returns integer
language sql stable security definer set search_path = '' as $$
  select private.min_price_per_30min(p_min_slots)
$$;
revoke all on function public.min_price_per_30min(integer) from public;
grant execute on function public.min_price_per_30min(integer) to anon, authenticated, service_role;

-- ===== 20260925000400_auth_and_rls.sql =====
-- thippo: ロール・権限・RLS
-- SPEC §3。権限は RLS と DB 側の制約で守る。画面で隠すだけの制御にはしない。
--
-- 方針
-- - anon / authenticated（ブラウザから届くリクエスト）には、テーブルごと・列ごとに必要な権限だけを付ける。
-- - 注文・予約・返金・審査などの状態を変える操作は、ブラウザから直接書かせない。
--   サーバー（service_role）または security definer の DB 関数（RPC）を通し、その中で権限を確かめる。
-- - 運営（admin）は 2 段階認証済み（JWT の aal が aal2）のときだけ admin として扱う。
-- - admin ロールの付与は DB を直接操作する運用者（postgres）だけができる。service_role でもできない。

-- ---------------------------------------------------------------------------
-- 補助関数
-- ---------------------------------------------------------------------------
create or replace function private.current_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.current_role() = 'admin' and (auth.jwt() ->> 'aal') = 'aal2',
    false
  )
$$;

create or replace function private.is_host_member(p_host_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.host_members hm
    join public.hosts h on h.id = hm.host_id
    where hm.user_id = auth.uid()
      and hm.host_id = p_host_id
      and h.deleted_at is null
      and private.current_role() = 'host'
  )
$$;

create or replace function private.is_active_guest() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_role() = 'guest', false)
$$;

-- 利用者サイトに表示してよいスペースか（公開中で、貸出主が active）
create or replace function private.is_space_public(p_space_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.spaces s
    join public.hosts h on h.id = s.host_id
    where s.id = p_space_id
      and s.status = 'published'
      and s.deleted_at is null
      and h.status = 'active'
      and h.deleted_at is null
  )
$$;

create or replace function private.space_host_id(p_space_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select host_id from public.spaces where id = p_space_id
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.current_role(),
  private.is_admin(),
  private.is_host_member(uuid),
  private.is_active_guest(),
  private.is_space_public(uuid),
  private.space_host_id(uuid),
  private.is_api_user(),
  private.pricing_config(),
  private.cfg(text),
  private.min_price_per_30min(integer)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 会員登録時に profiles を作る。ロールは常に guest（メタデータのロールは信用しない）。
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100), '')
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- profiles の保護
-- ---------------------------------------------------------------------------
create or replace function private.guard_profile() returns trigger
language plpgsql as $$
begin
  -- admin の付与・剥奪は DB を直接操作する運用者だけ（docs/admin-access.md）
  if (tg_op = 'INSERT' and new.role = 'admin')
     or (tg_op = 'UPDATE' and (new.role = 'admin') is distinct from (old.role = 'admin')) then
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'admin role can only be granted directly in the database'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

create trigger guard_profile
  before insert or update on public.profiles
  for each row execute function private.guard_profile();

-- ---------------------------------------------------------------------------
-- spaces の保護
-- ---------------------------------------------------------------------------
-- security invoker にする（current_user で API 経由かどうかを判定するため）。
create or replace function private.guard_space() returns trigger
language plpgsql set search_path = '' as $$
declare
  h public.hosts;
  min_price integer;
begin
  if private.is_api_user() then
    if tg_op = 'INSERT' and new.status <> 'draft' then
      raise exception 'new spaces must be draft' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if new.host_id <> old.host_id then
        raise exception 'host_id cannot be changed' using errcode = '42501';
      end if;
      -- 公開停止（suspended）は運営だけが付け外しできる
      if (new.status = 'suspended') is distinct from (old.status = 'suspended') then
        raise exception 'only admins can suspend or unsuspend a space' using errcode = '42501';
      end if;
    end if;
  end if;

  -- 料金の下限・上限（SPEC §5）
  if tg_op = 'INSERT'
     or new.price_per_30min <> old.price_per_30min
     or new.min_slots <> old.min_slots
     or (new.status = 'published' and old.status <> 'published') then
    min_price := private.min_price_per_30min(new.min_slots);
    if new.price_per_30min < min_price or new.price_per_30min > private.cfg('maxPricePer30min') then
      raise exception 'price_per_30min % is out of range (min % for min_slots %)',
        new.price_per_30min, min_price, new.min_slots
        using errcode = '23514', constraint = 'spaces_price_range';
    end if;
  end if;

  -- 公開できるのは、貸出主が active で Stripe のオンボーディングが完了している場合だけ（SPEC §9）
  if new.status = 'published' and new.deleted_at is null
     and (tg_op = 'INSERT' or old.status <> 'published') then
    select * into h from public.hosts where id = new.host_id;
    if not found then
      raise exception 'host is not ready to publish spaces' using errcode = '23514',
        constraint = 'spaces_host_ready';
    end if;
    if h.status <> 'active' or h.deleted_at is not null
       or not h.charges_enabled or not h.payouts_enabled then
      raise exception 'host is not ready to publish spaces' using errcode = '23514',
        constraint = 'spaces_host_ready';
    end if;
  end if;
  return new;
end
$$;

create trigger guard_space
  before insert or update on public.spaces
  for each row execute function private.guard_space();

-- ---------------------------------------------------------------------------
-- 予約カゴ：同じ貸出主のスペースだけ（SPEC §6）
-- ---------------------------------------------------------------------------
create or replace function private.guard_cart_item() returns trigger
language plpgsql set search_path = '' as $$
declare
  new_host uuid := private.space_host_id(new.space_id);
begin
  if private.is_api_user() and not private.is_space_public(new.space_id) then
    raise exception 'space is not available' using errcode = '23514', constraint = 'cart_items_space_public';
  end if;
  if exists (
    select 1 from public.cart_items ci
    where ci.cart_id = new.cart_id and private.space_host_id(ci.space_id) <> new_host
  ) then
    raise exception '予約カゴを分けて購入する必要があります'
      using errcode = '23514', constraint = 'cart_items_single_host';
  end if;
  return new;
end
$$;

create trigger guard_cart_item
  before insert on public.cart_items
  for each row execute function private.guard_cart_item();

-- ---------------------------------------------------------------------------
-- audit_logs は追記のみ（service_role を含め、更新・削除はできない）
-- ---------------------------------------------------------------------------
create or replace function private.deny_audit_log_change() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.deny_audit_log_change();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.deny_audit_log_change();

-- ---------------------------------------------------------------------------
-- テーブル・列の権限
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant usage, select on all sequences in schema private to service_role;
grant select on private.min_price_by_min_slots to service_role;

-- 公開情報（未ログインでも見られる。行は RLS で絞る）
grant select on public.spaces, public.space_photos, public.availability_rules, public.closures
  to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

grant select on public.identity_documents to authenticated;
grant insert (user_id, storage_path) on public.identity_documents to authenticated;

grant select on public.hosts to authenticated;
grant update (company_name, invoice_registration_number, address, phone) on public.hosts to authenticated;
grant select on public.host_members to authenticated;
grant select on public.host_applications to authenticated;

grant insert (host_id, name, description, address, area, capacity, amenities, price_per_30min, min_slots)
  on public.spaces to authenticated;
grant update (name, description, address, area, capacity, amenities, price_per_30min, min_slots, status, deleted_at)
  on public.spaces to authenticated;
grant insert (space_id, storage_path, sort_order), update (sort_order), delete
  on public.space_photos to authenticated;
grant insert (space_id, weekday, open_time, close_time), update (weekday, open_time, close_time), delete
  on public.availability_rules to authenticated;
grant insert (space_id, date), delete on public.closures to authenticated;

grant select, insert (guest_id), delete on public.carts to authenticated;
grant select, insert (cart_id, space_id, period), delete on public.cart_items to authenticated;

grant select on public.orders, public.bookings, public.booking_fees, public.refunds,
  public.cancel_events, public.monthly_statements, public.notifications, public.audit_logs
  to authenticated;
-- stripe_events はサーバー（service_role）だけが扱う

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.identity_documents enable row level security;
alter table public.host_applications enable row level security;
alter table public.hosts enable row level security;
alter table public.host_members enable row level security;
alter table public.spaces enable row level security;
alter table public.space_photos enable row level security;
alter table public.availability_rules enable row level security;
alter table public.closures enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_fees enable row level security;
alter table public.refunds enable row level security;
alter table public.cancel_events enable row level security;
alter table public.monthly_statements enable row level security;
alter table public.stripe_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and status = 'active' and deleted_at is null)
  with check (id = auth.uid());

-- identity_documents（本人と admin だけが読める）
create policy identity_documents_select on public.identity_documents for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy identity_documents_insert_self on public.identity_documents for insert to authenticated
  with check (user_id = auth.uid() and private.is_active_guest());

-- host_applications（申込はサーバーが受け付ける。閲覧は admin のみ）
create policy host_applications_select_admin on public.host_applications for select to authenticated
  using (private.is_admin());

-- hosts
create policy hosts_select on public.hosts for select to authenticated
  using (private.is_host_member(id) or private.is_admin());
create policy hosts_update_member on public.hosts for update to authenticated
  using (private.is_host_member(id) and status <> 'suspended')
  with check (private.is_host_member(id));

-- host_members
create policy host_members_select on public.host_members for select to authenticated
  using (user_id = auth.uid() or private.is_host_member(host_id) or private.is_admin());

-- spaces
create policy spaces_select_public on public.spaces for select to anon, authenticated
  using (private.is_space_public(id));
create policy spaces_select_member on public.spaces for select to authenticated
  using (private.is_host_member(host_id) or private.is_admin());
create policy spaces_insert_member on public.spaces for insert to authenticated
  with check (private.is_host_member(host_id));
create policy spaces_update_member on public.spaces for update to authenticated
  using (private.is_host_member(host_id) and deleted_at is null)
  with check (private.is_host_member(host_id));

-- スペースに付属する情報（写真・営業時間・休業日）
create policy space_photos_select on public.space_photos for select to anon, authenticated
  using (private.is_space_public(space_id) or private.is_host_member(private.space_host_id(space_id)) or private.is_admin());
create policy space_photos_write on public.space_photos for all to authenticated
  using (private.is_host_member(private.space_host_id(space_id)))
  with check (private.is_host_member(private.space_host_id(space_id)));

create policy availability_rules_select on public.availability_rules for select to anon, authenticated
  using (private.is_space_public(space_id) or private.is_host_member(private.space_host_id(space_id)) or private.is_admin());
create policy availability_rules_write on public.availability_rules for all to authenticated
  using (private.is_host_member(private.space_host_id(space_id)))
  with check (private.is_host_member(private.space_host_id(space_id)));

create policy closures_select on public.closures for select to anon, authenticated
  using (private.is_space_public(space_id) or private.is_host_member(private.space_host_id(space_id)) or private.is_admin());
create policy closures_write on public.closures for all to authenticated
  using (private.is_host_member(private.space_host_id(space_id)))
  with check (private.is_host_member(private.space_host_id(space_id)));

-- carts / cart_items（本人のみ）
create policy carts_own on public.carts for all to authenticated
  using (guest_id = auth.uid())
  with check (guest_id = auth.uid() and private.is_active_guest());
create policy cart_items_own on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.guest_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.guest_id = auth.uid()));

-- 注文・予約・料金内訳・返金（利用者本人・その貸出主・admin が読める。書き込みはサーバーと DB 関数のみ）
create policy orders_select on public.orders for select to authenticated
  using (guest_id = auth.uid() or private.is_host_member(host_id) or private.is_admin());
create policy bookings_select on public.bookings for select to authenticated
  using (guest_id = auth.uid() or private.is_host_member(host_id) or private.is_admin());
create policy booking_fees_select on public.booking_fees for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.guest_id = auth.uid() or private.is_host_member(b.host_id) or private.is_admin())
  ));
create policy refunds_select on public.refunds for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.guest_id = auth.uid() or private.is_host_member(b.host_id) or private.is_admin())
  ));

create policy cancel_events_select on public.cancel_events for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

create policy monthly_statements_select on public.monthly_statements for select to authenticated
  using (private.is_host_member(host_id) or private.is_admin());

create policy notifications_select_admin on public.notifications for select to authenticated
  using (private.is_admin());

create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (private.is_admin());

-- ===== 20260925000500_storage.sql =====
-- thippo: ストレージ
-- 本人確認書類は非公開バケット。パスは <user_id>/<ファイル名>。
-- 閲覧できるのは本人だけ。admin はサーバーが service_role で発行する有効期限の短い署名付き URL で閲覧し、
-- 閲覧したことを audit_logs に記録する（SPEC §3.3）。そのため admin 向けのポリシーは作らない。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('identity-documents', 'identity-documents', false, 10485760,
    array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']),
  ('space-photos', 'space-photos', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 本人確認書類
create policy identity_documents_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy identity_documents_owner_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.is_active_guest()
  );

-- スペースの写真（公開バケット。パスは <space_id>/<ファイル名>。書き込みはその貸出主の担当者のみ）
create policy space_photos_member_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'space-photos'
    and private.is_host_member(private.space_host_id(((storage.foldername(name))[1])::uuid))
  );

create policy space_photos_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'space-photos'
    and private.is_host_member(private.space_host_id(((storage.foldername(name))[1])::uuid))
  );

-- ===== 20260926000100_rate_limits_and_audit.sql =====
-- thippo: レート制限と操作ログ
-- SPEC §3.2, §3.3。付録 D5。

-- ---------------------------------------------------------------------------
-- レート制限（固定窓のカウンター）
-- ---------------------------------------------------------------------------
create table private.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
create index rate_limit_counters_window_idx on private.rate_limit_counters (window_start);

-- 1回分を数え、上限を超えていないかを返す。上限を超えた回も数える（連打しても窓は延びない）。
-- サーバー（service_role）だけが呼べる。キーは "login:ip:203.0.113.1" のように呼び出し側で作る。
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  win_start timestamptz;
  n integer;
begin
  if p_key is null or char_length(p_key) = 0 or char_length(p_key) > 300 then
    raise exception 'invalid rate limit key' using errcode = '22023';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  win_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limit_counters as c (key, window_start, hits)
  values (p_key, win_start, 1)
  on conflict (key, window_start) do update set hits = c.hits + 1
  returning c.hits into n;
  return query select
    n <= p_limit,
    n,
    greatest(0, ceil(extract(epoch from (win_start + make_interval(secs => p_window_seconds) - now()))))::integer;
end
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- 古いカウンターの削除（定期実行から呼ぶ。フェーズ10）
create or replace function private.purge_rate_limit_counters() returns integer
language sql security definer set search_path = '' as $$
  with d as (
    delete from private.rate_limit_counters where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::integer from d
$$;

-- ---------------------------------------------------------------------------
-- 操作ログ
-- ---------------------------------------------------------------------------
-- DB 関数（RPC）の中から、操作と同じトランザクションで記録するために使う。
create or replace function private.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_payload jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  new_id bigint;
begin
  if p_action is null or p_action !~ '^[a-z_]+(\.[a-z_]+)+$' then
    raise exception 'invalid audit action: %', p_action using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id, payload)
  values (p_actor_id, p_action, p_target_table, p_target_id, coalesce(p_payload, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end
$$;
revoke all on function private.write_audit_log(uuid, text, text, text, jsonb) from public;

-- 操作者の識別に使う JWT の情報（aal など）を毎回 payload に残せるように、補助関数を用意する。
create or replace function private.request_context() returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'aal', auth.jwt() ->> 'aal',
    'session_id', auth.jwt() ->> 'session_id'
  ))
$$;

-- ===== 20260927000100_identity_review.sql =====
-- thippo: 本人確認書類の提出と審査
-- SPEC §3.3, §6, §10。付録 D10（原則は表面のみ、必要なら両面）・D11（何度でも再提出できる）。

create type public.identity_document_type as enum (
  'drivers_license',   -- 運転免許証
  'my_number_card',    -- マイナンバーカード（表面のみ。裏面の個人番号は受け付けない）
  'passport',          -- パスポート
  'residence_card'     -- 在留カード
);

-- 1行 = 1回の提出。表面は必須、裏面は運営が両面の提出を求めたときなど任意。
alter table public.identity_documents rename column storage_path to front_path;
alter table public.identity_documents rename constraint identity_documents_path_owner to identity_documents_front_owner;
alter table public.identity_documents
  add column document_type public.identity_document_type not null default 'drivers_license',
  add column back_path text unique,
  -- 却下したときに、次の提出で両面を求めるか
  add column back_side_requested boolean not null default false,
  add constraint identity_documents_back_owner
    check (back_path is null or split_part(back_path, '/', 1) = user_id::text),
  add constraint identity_documents_distinct_sides check (back_path is null or back_path <> front_path),
  add constraint identity_documents_no_my_number_back
    check (document_type <> 'my_number_card' or back_path is null),
  add constraint identity_documents_back_request_on_reject
    check (not back_side_requested or status = 'rejected');
alter table public.identity_documents alter column document_type drop default;

-- 審査中の提出は1人1件まで
create unique index identity_documents_one_pending on public.identity_documents (user_id) where status = 'pending';

-- 提出は DB 関数（submit_identity_document）だけで行う。ブラウザからの直接の insert はやめる。
drop policy identity_documents_insert_self on public.identity_documents;
revoke insert on public.identity_documents from authenticated;

-- ---------------------------------------------------------------------------
-- 提出
-- ---------------------------------------------------------------------------
-- ファイルは利用者がブラウザから自分のフォルダ（<user_id>/...）にアップロードしておき、そのパスを渡す。
-- エラーは message にコードを入れて返す（アプリ側で日本語に置き換える）。
create or replace function public.submit_identity_document(
  p_document_type public.identity_document_type,
  p_front_path text,
  p_back_path text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  last_doc public.identity_documents;
  new_id uuid;
  p text;
begin
  if uid is null or not private.is_active_guest() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- 同じ利用者の同時の提出を直列にする
  select * into prof from public.profiles where id = uid for update;
  if prof.identity_status = 'pending' then
    raise exception 'identity_already_pending' using errcode = 'P0001';
  end if;
  if prof.identity_status = 'approved' then
    raise exception 'identity_already_approved' using errcode = 'P0001';
  end if;

  if p_back_path = '' then p_back_path := null; end if;
  if p_document_type = 'my_number_card' and p_back_path is not null then
    raise exception 'my_number_back_not_allowed' using errcode = 'P0001';
  end if;

  select * into last_doc from public.identity_documents
   where user_id = uid order by submitted_at desc limit 1;
  if found and last_doc.status = 'rejected' and last_doc.back_side_requested and p_back_path is null then
    raise exception 'back_side_required' using errcode = 'P0001';
  end if;

  foreach p in array array_remove(array[p_front_path, p_back_path], null) loop
    if split_part(p, '/', 1) <> uid::text then
      raise exception 'invalid_path' using errcode = 'P0001';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'identity-documents' and o.name = p) then
      raise exception 'file_not_found' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.identity_documents d where d.front_path = p or d.back_path = p) then
      raise exception 'file_already_used' using errcode = 'P0001';
    end if;
  end loop;
  if p_back_path = p_front_path then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;

  insert into public.identity_documents (user_id, document_type, front_path, back_path)
  values (uid, p_document_type, p_front_path, p_back_path)
  returning id into new_id;

  update public.profiles set identity_status = 'pending' where id = uid;
  return new_id;
end
$$;
revoke all on function public.submit_identity_document(public.identity_document_type, text, text) from public, anon;
grant execute on function public.submit_identity_document(public.identity_document_type, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 審査（運営）
-- ---------------------------------------------------------------------------
create or replace function public.review_identity_document(
  p_document_id uuid,
  p_approve boolean,
  p_reject_reason text default null,
  p_request_back_side boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  doc public.identity_documents;
  reason text := nullif(btrim(coalesce(p_reject_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into doc from public.identity_documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found' using errcode = 'P0001';
  end if;
  if doc.status <> 'pending' then
    raise exception 'document_not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    update public.identity_documents
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = doc.id;
    update public.profiles set identity_status = 'approved' where id = doc.user_id;
  else
    if reason is null or char_length(reason) > 1000 then
      raise exception 'reject_reason_required' using errcode = 'P0001';
    end if;
    update public.identity_documents
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
           reject_reason = reason, back_side_requested = coalesce(p_request_back_side, false)
     where id = doc.id;
    update public.profiles set identity_status = 'rejected' where id = doc.user_id;
  end if;

  perform private.write_audit_log(
    auth.uid(),
    case when p_approve then 'identity.approve' else 'identity.reject' end,
    'identity_documents',
    doc.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'user_id', doc.user_id,
      'reject_reason', case when p_approve then null else reason end,
      'back_side_requested', case when p_approve then null else coalesce(p_request_back_side, false) end
    )) || private.request_context()
  );
end
$$;
revoke all on function public.review_identity_document(uuid, boolean, text, boolean) from public, anon;
grant execute on function public.review_identity_document(uuid, boolean, text, boolean) to authenticated;

-- 審査の一覧で利用者の名前・メールアドレスを表示するため、admin は profiles を読める（既存の profiles_select）。

-- ===== 20260928000100_hosts_and_spaces.sql =====
-- thippo: 掲載申込の承認、Stripe の Webhook、スペース管理、空き枠
-- SPEC §6, §7, §9, §10。付録 D13〜D16。

-- ---------------------------------------------------------------------------
-- 担当者は1つの貸出主（企業）にだけ所属する（貸出主センターは所属先を1つとして扱う）
-- ---------------------------------------------------------------------------
create unique index host_members_one_host_per_user on public.host_members (user_id);

-- ---------------------------------------------------------------------------
-- 掲載申込の承認・却下（運営）
-- ---------------------------------------------------------------------------
-- 担当者の Auth ユーザーは、サーバーが service role で招待（inviteUserByEmail）して作り、その id を渡す。
-- 招待したばかりの、ほかに何も持っていないアカウントだけを貸出主の担当者にできる（付録 D6・D13）。
create or replace function public.approve_host_application(p_application_id uuid, p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  app public.host_applications;
  prof public.profiles;
  new_host_id uuid;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into app from public.host_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0001';
  end if;
  if app.status <> 'pending' then
    raise exception 'application_not_pending' using errcode = 'P0001';
  end if;

  select * into prof from public.profiles where id = p_user_id for update;
  if not found or lower(prof.email) <> lower(app.email) then
    raise exception 'invalid_invitee' using errcode = 'P0001';
  end if;
  if prof.role <> 'guest' or prof.identity_status <> 'unsubmitted' or prof.deleted_at is not null
     or exists (select 1 from public.orders o where o.guest_id = prof.id)
     or exists (select 1 from public.host_members m where m.user_id = prof.id) then
    raise exception 'email_already_registered' using errcode = 'P0001';
  end if;

  insert into public.hosts (company_name, address, phone, status, application_id)
  values (app.company_name, app.address, app.phone, 'active', app.id)
  returning id into new_host_id;

  insert into public.host_members (host_id, user_id) values (new_host_id, prof.id);
  update public.profiles
     set role = 'host', display_name = coalesce(prof.display_name, app.contact_name), phone = coalesce(prof.phone, app.phone)
   where id = prof.id;
  update public.host_applications
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), host_id = new_host_id
   where id = app.id;

  perform private.write_audit_log(
    auth.uid(), 'host_application.approve', 'host_applications', app.id::text,
    jsonb_build_object('host_id', new_host_id, 'member_user_id', prof.id) || private.request_context()
  );
  return new_host_id;
end
$$;
revoke all on function public.approve_host_application(uuid, uuid) from public, anon;
grant execute on function public.approve_host_application(uuid, uuid) to authenticated;

create or replace function public.reject_host_application(p_application_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  app public.host_applications;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if reason is null or char_length(reason) > 1000 then
    raise exception 'reject_reason_required' using errcode = 'P0001';
  end if;
  select * into app from public.host_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0001';
  end if;
  if app.status <> 'pending' then
    raise exception 'application_not_pending' using errcode = 'P0001';
  end if;
  update public.host_applications
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), reject_reason = reason
   where id = app.id;
  perform private.write_audit_log(
    auth.uid(), 'host_application.reject', 'host_applications', app.id::text,
    jsonb_build_object('reason', reason) || private.request_context()
  );
end
$$;
revoke all on function public.reject_host_application(uuid, text) from public, anon;
grant execute on function public.reject_host_application(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Stripe の Webhook の重複処理防止（SPEC §7-5）
-- ---------------------------------------------------------------------------
alter table public.stripe_events
  add column locked_until timestamptz,
  add column attempts integer not null default 0;

-- イベントを処理してよいかを確かめて「処理中」にする。
-- 処理済みのイベント、ほかのリクエストが処理中のイベントは false（二重に処理しない）。
-- 処理中のまま一定時間が過ぎたもの（途中で落ちたもの）は、再送されたときに処理し直せる。
create or replace function public.claim_stripe_event(p_event_id text, p_type text, p_payload jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  claimed boolean;
begin
  insert into public.stripe_events as e (event_id, type, payload, locked_until, attempts)
  values (p_event_id, p_type, p_payload, now() + interval '5 minutes', 1)
  on conflict (event_id) do update
    set locked_until = now() + interval '5 minutes', attempts = e.attempts + 1, error = null
    where e.processed_at is null and (e.locked_until is null or e.locked_until < now())
  returning true into claimed;
  return coalesce(claimed, false);
end
$$;

create or replace function public.complete_stripe_event(p_event_id text, p_error text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.stripe_events
     set processed_at = case when p_error is null then now() else null end,
         error = p_error,
         locked_until = null
   where event_id = p_event_id
$$;

revoke all on function public.claim_stripe_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.complete_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text, jsonb) to service_role;
grant execute on function public.complete_stripe_event(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- スペース
-- ---------------------------------------------------------------------------
-- 写真は1スペース5枚まで（付録 D16）
create or replace function private.guard_space_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.spaces where id = new.space_id for update;
  if (select count(*) from public.space_photos where space_id = new.space_id) >= 5 then
    raise exception 'too_many_photos' using errcode = '23514', constraint = 'space_photos_limit';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.space_id::text then
    raise exception 'invalid_path' using errcode = '23514', constraint = 'space_photos_path';
  end if;
  return new;
end
$$;

create trigger guard_space_photo
  before insert on public.space_photos
  for each row execute function private.guard_space_photo();

-- 写真のファイルがアップロード済みであること（ストレージにないパスを登録させない）
alter table public.space_photos add constraint space_photos_path_unique unique (storage_path);

-- これからの予約（pending / confirmed）があるスペースは削除できない
create or replace function private.guard_space_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if exists (
      select 1 from public.bookings b
      where b.space_id = new.id and b.status in ('pending', 'confirmed') and upper(b.period) > now()
    ) then
      raise exception 'space_has_upcoming_bookings' using errcode = '23514';
    end if;
    new.status := case when old.status = 'suspended' then 'suspended' else 'draft' end;
  end if;
  return new;
end
$$;

create trigger guard_space_delete
  before update of deleted_at on public.spaces
  for each row execute function private.guard_space_delete();

-- 営業時間をまとめて置き換える。重なる時間帯は受け付けない。
-- p_rules: [{"weekday": 1, "open_time": "09:00", "close_time": "18:00"}, ...]
create or replace function public.replace_availability_rules(p_space_id uuid, p_rules jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not private.is_host_member(private.space_host_id(p_space_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 70 then
    raise exception 'invalid_rules' using errcode = 'P0001';
  end if;
  perform 1 from public.spaces where id = p_space_id for update;

  delete from public.availability_rules where space_id = p_space_id;
  for r in select * from jsonb_array_elements(p_rules) loop
    insert into public.availability_rules (space_id, weekday, open_time, close_time)
    values (p_space_id, (r ->> 'weekday')::smallint, (r ->> 'open_time')::time, (r ->> 'close_time')::time);
  end loop;

  if exists (
    select 1 from public.availability_rules a
    join public.availability_rules b
      on a.space_id = b.space_id and a.weekday = b.weekday and a.id < b.id
     and a.open_time < b.close_time and b.open_time < a.close_time
    where a.space_id = p_space_id
  ) then
    raise exception 'overlapping_rules' using errcode = 'P0001';
  end if;
end
$$;
revoke all on function public.replace_availability_rules(uuid, jsonb) from public, anon;
grant execute on function public.replace_availability_rules(uuid, jsonb) to authenticated;

-- 空き枠の計算に使う、予約済み（pending / confirmed）の期間だけを返す。誰の予約かは返さない。
-- 公開中のスペースは誰でも、非公開のスペースはその貸出主と admin だけが呼べる。期間は最大62日。
create or replace function public.space_busy_periods(p_space_id uuid, p_from timestamptz, p_to timestamptz)
returns table (period_start timestamptz, period_end timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (
    private.is_space_public(p_space_id)
    or private.is_host_member(private.space_host_id(p_space_id))
    or private.is_admin()
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '62 days' then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  return query
    select lower(b.period), upper(b.period)
    from public.bookings b
    where b.space_id = p_space_id
      and b.status in ('pending', 'confirmed')
      and b.period && tstzrange(p_from, p_to, '[)')
    order by lower(b.period);
end
$$;
revoke all on function public.space_busy_periods(uuid, timestamptz, timestamptz) from public;
grant execute on function public.space_busy_periods(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- 利用者サイトで表示する貸出主の情報（会社名だけ。Stripe の情報などは出さない）
create or replace view public.public_hosts with (security_barrier = true) as
  select h.id, h.company_name
  from public.hosts h
  where h.status = 'active' and h.deleted_at is null;
grant select on public.public_hosts to anon, authenticated;

-- ===== 20260929000100_search_and_cart.sql =====
-- thippo: スペースの検索と予約カゴ
-- SPEC §6。付録 D17・D18。

-- ---------------------------------------------------------------------------
-- 検索：公開中（published）で、貸出主が active のスペースだけ（SPEC §6）
-- キーワードはエリアまたはスペース名の部分一致、人数は定員が指定人数以上（D17）。
-- 日付の条件（その日に空き枠があるか）は packages/core の枠の計算でアプリ側が絞り込む。
-- ---------------------------------------------------------------------------
create or replace function public.search_spaces(
  p_keyword text default null,
  p_min_capacity integer default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  host_id uuid,
  company_name text,
  name text,
  area text,
  address text,
  capacity integer,
  price_per_30min integer,
  min_slots integer,
  cover_path text
)
language sql stable security definer set search_path = '' as $$
  with kw as (
    -- LIKE の特殊文字を無効にする
    select nullif(btrim(replace(replace(replace(coalesce(p_keyword, ''), '\', '\\'), '%', '\%'), '_', '\_')), '') as k
  )
  select s.id, s.host_id, h.company_name, s.name, s.area, s.address, s.capacity, s.price_per_30min, s.min_slots,
         (select p.storage_path from public.space_photos p where p.space_id = s.id
           order by p.sort_order, p.created_at limit 1)
  from public.spaces s
  join public.hosts h on h.id = s.host_id
  cross join kw
  where s.status = 'published' and s.deleted_at is null
    and h.status = 'active' and h.deleted_at is null
    and (kw.k is null or s.name ilike '%' || kw.k || '%' or s.area ilike '%' || kw.k || '%')
    and (p_min_capacity is null or s.capacity >= p_min_capacity)
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;
revoke all on function public.search_spaces(text, integer, integer) from public;
grant execute on function public.search_spaces(text, integer, integer) to anon, authenticated, service_role;

-- 複数のスペースの予約済みの期間（一覧の日付検索・予約カゴの確認用）。公開中のスペースだけ。
create or replace function public.spaces_busy_periods(p_space_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (space_id uuid, period_start timestamptz, period_end timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(array_length(p_space_ids, 1), 0) > 500 then
    raise exception 'too_many_spaces' using errcode = 'P0001';
  end if;
  if p_to <= p_from or p_to - p_from > interval '62 days' then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  return query
    select b.space_id, lower(b.period), upper(b.period)
    from public.bookings b
    where b.space_id = any (p_space_ids)
      and private.is_space_public(b.space_id)
      and b.status in ('pending', 'confirmed')
      and b.period && tstzrange(p_from, p_to, '[)')
    order by b.space_id, lower(b.period);
end
$$;
revoke all on function public.spaces_busy_periods(uuid[], timestamptz, timestamptz) from public;
grant execute on function public.spaces_busy_periods(uuid[], timestamptz, timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 予約カゴ
-- ---------------------------------------------------------------------------
-- 同じカゴの中で、同じスペースの重なる時間帯を入れられない（購入時に必ず失敗するため）
alter table public.cart_items
  add constraint cart_items_no_overlap exclude using gist (cart_id with =, space_id with =, period with &&);

-- 1つのカゴは10件まで。予約1件の長さは48枠（24時間）まで。
alter table public.cart_items
  add constraint cart_items_max_length check (upper(period) - lower(period) <= interval '24 hours');

create or replace function private.guard_cart_item_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.carts where id = new.cart_id for update;
  if (select count(*) from public.cart_items where cart_id = new.cart_id) >= 10 then
    raise exception 'cart_full' using errcode = '23514', constraint = 'cart_items_limit';
  end if;
  return new;
end
$$;

create trigger guard_cart_item_count
  before insert on public.cart_items
  for each row execute function private.guard_cart_item_count();

-- ===== 20260930000100_booking_expired_status.sql =====
-- thippo: 期限切れの予約の状態
-- pending のまま15分経った注文を expired にするとき、その予約も枠を解放する必要がある（SPEC §7-4）。
-- cancelled（キャンセル）とは区別するため、予約にも expired を追加する。
alter type public.booking_status add value if not exists 'expired' after 'pending';

-- ===== 20260930000200_checkout.sql =====
-- thippo: 購入手続き・決済
-- SPEC §7。付録 D8（期限切れと支払いが重なった場合）・D20（カードのみ）。

alter table public.orders
  add column host_stripe_account_id text,
  -- 期限切れ・失敗のあとで支払いが成功し、自動で全額返金したとき（D8）
  add column late_payment_refund_id text unique,
  add column late_payment_refunded_at timestamptz;

create index orders_payment_intent_idx on public.orders (stripe_payment_intent_id);

-- ---------------------------------------------------------------------------
-- 予約できる期間か（DB 側の確認。packages/core の validateBookingPeriod と同じ条件）
-- - 開始が今より後、終了が今から30日以内
-- - 最低利用枠数以上、48枠以下、1日（東京時間）の中
-- - 休業日でなく、すべての30分枠がその曜日の営業時間に含まれる
-- ---------------------------------------------------------------------------
create or replace function private.is_bookable_period(p_space_id uuid, p_period tstzrange, p_min_slots integer)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  start_local timestamp := lower(p_period) at time zone 'Asia/Tokyo';
  end_local timestamp := upper(p_period) at time zone 'Asia/Tokyo';
  slots integer := (extract(epoch from (upper(p_period) - lower(p_period))) / 1800)::integer;
  local_date date := (lower(p_period) at time zone 'Asia/Tokyo')::date;
  day_start_minutes integer;
begin
  if lower(p_period) <= now() then return false; end if;
  if upper(p_period) > now() + make_interval(days => private.cfg('maxAdvanceDays')) then return false; end if;
  if slots < p_min_slots or slots > private.cfg('maxSlotsPerBooking') then return false; end if;
  -- 1日の中（終了は翌日の0:00まで）
  if end_local > (local_date + 1)::timestamp then return false; end if;
  if exists (select 1 from public.closures c where c.space_id = p_space_id and c.date = local_date) then
    return false;
  end if;
  day_start_minutes := extract(hour from start_local)::integer * 60 + extract(minute from start_local)::integer;
  return not exists (
    select 1
    from generate_series(0, slots - 1) k
    where not exists (
      select 1 from public.availability_rules r
      where r.space_id = p_space_id
        and r.weekday = extract(dow from local_date)::integer
        and (extract(epoch from r.open_time) / 60)::integer <= day_start_minutes + k * 30
        and day_start_minutes + (k + 1) * 30 <= (extract(epoch from r.close_time) / 60)::integer
    )
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 注文の作成（SPEC §7-1）。予約カゴの内容から、1つのトランザクションで
-- orders（pending）・bookings（pending）・booking_fees を作る。金額は DB 側の料金で計算し直す。
-- サーバー（service_role）だけが呼ぶ。利用者はサーバー側で確かめた guest_id で渡す。
-- ---------------------------------------------------------------------------
create or replace function public.create_order_from_cart(p_guest_id uuid)
returns table (
  order_id uuid,
  order_number text,
  total integer,
  application_fee_amount integer,
  host_stripe_account_id text
)
language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  v_cart_id uuid;
  host_ids uuid[];
  h public.hosts;
  new_order_id uuid;
  it record;
  f private.booking_fee_breakdown;
  sum_total integer := 0;
  sum_fee integer := 0;
  new_booking_id uuid;
begin
  select * into prof from public.profiles where id = p_guest_id for update;
  if not found or prof.role <> 'guest' or prof.status <> 'active' or prof.deleted_at is not null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if prof.identity_status <> 'approved' then
    raise exception 'identity_not_approved' using errcode = 'P0001';
  end if;

  select c.id into v_cart_id from public.carts c where c.guest_id = p_guest_id for update;
  if v_cart_id is null or not exists (select 1 from public.cart_items ci where ci.cart_id = v_cart_id) then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;

  select array_agg(distinct s.host_id) into host_ids
  from public.cart_items ci join public.spaces s on s.id = ci.space_id
  where ci.cart_id = v_cart_id;
  if array_length(host_ids, 1) <> 1 then
    raise exception 'multiple_hosts' using errcode = 'P0001';
  end if;

  select * into h from public.hosts where id = host_ids[1];
  if h.status <> 'active' or h.deleted_at is not null or not h.charges_enabled or h.stripe_account_id is null then
    raise exception 'host_unavailable' using errcode = 'P0001';
  end if;

  insert into public.orders (guest_id, host_id, total, application_fee_amount, expires_at, host_stripe_account_id)
  values (p_guest_id, h.id, 1, 0, now() + make_interval(mins => private.cfg('pendingOrderTtlMinutes')), h.stripe_account_id)
  returning id into new_order_id;

  for it in
    select ci.space_id, ci.period, s.price_per_30min, s.min_slots
    from public.cart_items ci join public.spaces s on s.id = ci.space_id
    where ci.cart_id = v_cart_id
    order by lower(ci.period)
  loop
    if not private.is_space_public(it.space_id) then
      raise exception 'space_unavailable' using errcode = 'P0001';
    end if;
    if not private.is_bookable_period(it.space_id, it.period, it.min_slots) then
      raise exception 'period_unavailable' using errcode = 'P0001';
    end if;
    f := private.calc_booking_fees(
      it.price_per_30min,
      (extract(epoch from (upper(it.period) - lower(it.period))) / 1800)::integer
    );
    begin
      insert into public.bookings (order_id, space_id, guest_id, host_id, period, slots, price_per_30min, total)
      values (new_order_id, it.space_id, p_guest_id, h.id, it.period, f.slots, it.price_per_30min, f.subtotal)
      returning id into new_booking_id;
    exception when exclusion_violation then
      -- 他の方が先に予約した（SPEC §4.1）
      raise exception 'slot_taken' using errcode = 'P0001';
    end;
    insert into public.booking_fees
      (booking_id, hours, platform_fee_excl_tax, platform_fee_tax, stripe_fee_estimated, application_fee)
    values (new_booking_id, f.hours, f.platform_fee_excl_tax, f.platform_fee_tax, f.stripe_fee_estimated, f.application_fee);
    sum_total := sum_total + f.subtotal;
    sum_fee := sum_fee + f.application_fee;
  end loop;

  update public.orders o set total = sum_total, application_fee_amount = sum_fee where o.id = new_order_id;

  return query
    select o.id, o.order_number, o.total, o.application_fee_amount, o.host_stripe_account_id
    from public.orders o where o.id = new_order_id;
end
$$;
revoke all on function public.create_order_from_cart(uuid) from public, anon, authenticated;
grant execute on function public.create_order_from_cart(uuid) to service_role;

create or replace function public.set_order_payment_intent(p_order_id uuid, p_payment_intent_id text)
returns void
language sql security definer set search_path = '' as $$
  update public.orders set stripe_payment_intent_id = p_payment_intent_id
  where id = p_order_id and status = 'pending' and stripe_payment_intent_id is null
$$;
revoke all on function public.set_order_payment_intent(uuid, text) from public, anon, authenticated;
grant execute on function public.set_order_payment_intent(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 支払いの確定（Webhook の payment_intent.succeeded。SPEC §7-3）
-- 戻り値: 'paid'（今回 paid にした）/ 'already_paid'（処理済み）/ 'late'（期限切れ・失敗のあとの支払い。D8）
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_payment_intent_id text,
  p_amount integer,
  p_charge_id text,
  p_transfer_id text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if o.stripe_payment_intent_id is distinct from p_payment_intent_id then
    raise exception 'payment_intent_mismatch' using errcode = 'P0001';
  end if;
  if o.status = 'paid' then return 'already_paid'; end if;
  if o.status in ('expired', 'failed') then return 'late'; end if;
  if p_amount <> o.total then
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'paid', paid_at = now(), stripe_charge_id = p_charge_id, stripe_transfer_id = p_transfer_id
   where id = o.id;
  update public.bookings set status = 'confirmed' where order_id = o.id and status = 'pending';

  -- 支払った予約と同じ枠をカゴから外す
  delete from public.cart_items ci
  using public.carts c, public.bookings b
  where ci.cart_id = c.id and c.guest_id = o.guest_id
    and b.order_id = o.id and b.space_id = ci.space_id and b.period && ci.period;
  return 'paid';
end
$$;
revoke all on function public.mark_order_paid(uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, integer, text, text) to service_role;

create or replace function public.record_late_payment_refund(p_order_id uuid, p_refund_id text)
returns void
language sql security definer set search_path = '' as $$
  update public.orders
     set late_payment_refund_id = p_refund_id, late_payment_refunded_at = now()
   where id = p_order_id and late_payment_refund_id is null
$$;
revoke all on function public.record_late_payment_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.record_late_payment_refund(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 期限切れ・失敗（枠を解放する。SPEC §7-4）
-- ---------------------------------------------------------------------------
-- 1件の注文を expired / failed にする。pending のときだけ。戻り値は PaymentIntent の id（取り消し用）。
create or replace function public.close_pending_order(p_order_id uuid, p_status public.order_status)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if p_status not in ('expired', 'failed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.orders set status = p_status
   where id = p_order_id and status = 'pending'
  returning * into o;
  if not found then return null; end if;
  update public.bookings set status = 'expired' where order_id = o.id and status = 'pending';
  return o.stripe_payment_intent_id;
end
$$;

-- 15分以上 pending の注文をまとめて expired にする（定期実行から呼ぶ）
create or replace function public.expire_due_orders(p_limit integer default 200)
returns table (order_id uuid, payment_intent_id text)
language plpgsql security definer set search_path = '' as $$
declare
  due record;
begin
  for due in
    select o.id from public.orders o
    where o.status = 'pending' and o.expires_at <= now()
    order by o.expires_at
    limit p_limit
    for update skip locked
  loop
    order_id := due.id;
    payment_intent_id := public.close_pending_order(due.id, 'expired');
    return next;
  end loop;
end
$$;

revoke all on function public.close_pending_order(uuid, public.order_status) from public, anon, authenticated;
revoke all on function public.expire_due_orders(integer) from public, anon, authenticated;
grant execute on function public.close_pending_order(uuid, public.order_status) to service_role;
grant execute on function public.expire_due_orders(integer) to service_role;

-- ===== 20261001000100_cancellation.sql =====
-- thippo: キャンセルと返金
-- SPEC §8・§8.1。付録 D3（返金の有無にかかわらず利用者のキャンセルはすべて数える）・D4（予約ごとにキャンセル）。

-- ---------------------------------------------------------------------------
-- 判定（packages/core の decideCancellation・calcRefund と同じ。テストで一致を確かめる）
-- ---------------------------------------------------------------------------
create or replace function private.decide_cancel_policy(
  p_actor public.cancel_actor,
  p_now timestamptz,
  p_start timestamptz,
  p_recent_guest_cancels integer
) returns public.cancel_policy
language sql immutable as $$
  select case
    when p_actor <> 'guest' then 'full'::public.cancel_policy
    when p_now >= p_start then 'none'
    when p_recent_guest_cancels >= private.cfg('maxCancelsBeforeNoRefund') then 'none'
    when p_now < p_start - make_interval(mins => private.cfg('fullRefundBeforeMinutes')) then 'full'
    else 'half'
  end
$$;

create type private.refund_breakdown as (
  refund_amount integer,
  transfer_reversal_amount integer,
  platform_fee_excl_tax integer,
  platform_fee_tax integer
);

-- 差し戻し額は比例配分に任せず、予約ごとに明示する（SPEC §8.1）
create or replace function private.calc_refund(
  p_subtotal integer,
  p_application_fee integer,
  p_platform_fee_excl_tax integer,
  p_hours integer,
  p_policy public.cancel_policy
) returns private.refund_breakdown
language plpgsql immutable as $$
declare
  r private.refund_breakdown;
  kept_excl integer;
begin
  case p_policy
    when 'full' then
      r.refund_amount := p_subtotal;
      r.transfer_reversal_amount := p_subtotal - p_application_fee;
      r.platform_fee_excl_tax := 0;
    when 'half' then
      r.refund_amount := p_subtotal / 2;
      kept_excl := private.cfg('halfCancelPlatformFeePerHourExclTax') * p_hours;
      r.transfer_reversal_amount := r.refund_amount - (kept_excl + kept_excl * private.cfg('consumptionTaxPercent') / 100);
      r.platform_fee_excl_tax := kept_excl;
    else
      r.refund_amount := 0;
      r.transfer_reversal_amount := 0;
      r.platform_fee_excl_tax := p_platform_fee_excl_tax;
  end case;
  r.platform_fee_tax := r.platform_fee_excl_tax * private.cfg('consumptionTaxPercent') / 100;
  if r.transfer_reversal_amount < 0 or r.transfer_reversal_amount > p_subtotal - p_application_fee then
    raise exception 'transfer reversal out of range' using errcode = 'P0001';
  end if;
  return r;
end
$$;

-- ---------------------------------------------------------------------------
-- キャンセル（SPEC §8）
-- 回数の確認・判定・記録を、利用者単位の advisory lock を取ったうえで1つのトランザクションで行う。
-- サーバー（service_role）だけが呼ぶ。操作者は、サーバーで確かめた id とロールで渡す。
-- 予約はここで cancelled にして枠を解放し、返金の完了は Webhook（charge.refunded）で refunds に反映する。
-- ---------------------------------------------------------------------------
alter table public.refunds
  add column reversal_attempted_at timestamptz,
  add column completed_at timestamptz;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_actor public.cancel_actor,
  p_actor_id uuid,
  p_reason text default null
)
returns table (
  refund_id uuid,
  policy public.cancel_policy,
  refund_amount integer,
  transfer_reversal_amount integer,
  nth_cancel_in_window integer,
  stripe_charge_id text,
  stripe_transfer_id text
)
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  o public.orders;
  fees public.booking_fees;
  actor_prof public.profiles;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
  recent integer := null;
  decided public.cancel_policy;
  r private.refund_breakdown;
  new_refund_id uuid;
begin
  -- 同じ利用者のキャンセルを直列にするため、予約を読む前に利用者単位のロックを取る
  select bb.guest_id into b.guest_id from public.bookings bb where bb.id = p_booking_id;
  if b.guest_id is null then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('thippo.cancel:' || b.guest_id::text, 0));

  select * into b from public.bookings where id = p_booking_id for update;
  select * into o from public.orders where id = b.order_id for update;
  select * into fees from public.booking_fees where booking_id = b.id;

  select * into actor_prof from public.profiles where id = p_actor_id;
  if not found or actor_prof.status <> 'active' or actor_prof.deleted_at is not null
     or actor_prof.role::text <> p_actor::text then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_actor = 'guest' and b.guest_id <> p_actor_id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_actor = 'host' and not exists (
    select 1 from public.host_members m where m.host_id = b.host_id and m.user_id = p_actor_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_actor in ('host', 'admin') and (reason is null or char_length(reason) > 1000) then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  if b.status <> 'confirmed' or o.status <> 'paid' then
    raise exception 'booking_not_cancellable' using errcode = 'P0001';
  end if;
  if upper(b.period) <= now() then
    raise exception 'booking_finished' using errcode = 'P0001';
  end if;

  if p_actor = 'guest' then
    select count(*)::integer into recent
    from public.cancel_events e
    where e.user_id = b.guest_id
      and e.created_at > now() - make_interval(hours => private.cfg('cancelCountWindowHours'));
  end if;
  decided := private.decide_cancel_policy(p_actor, now(), lower(b.period), coalesce(recent, 0));
  r := private.calc_refund(b.total, fees.application_fee, fees.platform_fee_excl_tax, fees.hours, decided);

  update public.bookings
     set status = 'cancelled', cancelled_by = p_actor, cancelled_at = now(), cancel_policy = decided,
         cancel_reason = reason
   where id = b.id;

  -- 利用者自身のキャンセルは、返金の有無にかかわらず数える（D3）。貸出主・運営のキャンセルは数えない
  if p_actor = 'guest' then
    insert into public.cancel_events (user_id, booking_id) values (b.guest_id, b.id);
  end if;

  insert into public.refunds (
    booking_id, policy, refund_amount, transfer_reversal_amount, platform_fee_excl_tax, platform_fee_tax,
    status, created_by, completed_at
  ) values (
    b.id, decided, r.refund_amount, r.transfer_reversal_amount, r.platform_fee_excl_tax, r.platform_fee_tax,
    -- 返金が0円なら Stripe の処理を行わない（SPEC §8.1）
    case when r.refund_amount = 0 then 'succeeded'::public.refund_status else 'pending' end,
    p_actor_id,
    case when r.refund_amount = 0 then now() end
  ) returning id into new_refund_id;

  if p_actor in ('host', 'admin') then
    perform private.write_audit_log(
      p_actor_id, p_actor::text || '.booking_cancel', 'bookings', b.id::text,
      jsonb_build_object('reason', reason, 'refund_amount', r.refund_amount, 'refund_id', new_refund_id)
    );
  end if;

  return query select
    new_refund_id, decided, r.refund_amount, r.transfer_reversal_amount,
    case when p_actor = 'guest' then recent + 1 end,
    o.stripe_charge_id, o.stripe_transfer_id;
end
$$;
revoke all on function public.cancel_booking(uuid, public.cancel_actor, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid, public.cancel_actor, uuid, text) to service_role;

-- キャンセル画面の確認用：過去24時間の利用者自身のキャンセル回数
create or replace function public.recent_guest_cancel_count(p_guest_id uuid)
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.cancel_events e
  where e.user_id = p_guest_id
    and e.created_at > now() - make_interval(hours => private.cfg('cancelCountWindowHours'))
$$;
revoke all on function public.recent_guest_cancel_count(uuid) from public, anon, authenticated;
grant execute on function public.recent_guest_cancel_count(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 返金の記録（Stripe の処理の結果）
-- ---------------------------------------------------------------------------
create or replace function public.record_refund_progress(
  p_refund_id uuid,
  p_stripe_refund_id text,
  p_stripe_transfer_reversal_id text,
  p_error text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.refunds
     set stripe_refund_id = coalesce(stripe_refund_id, p_stripe_refund_id),
         stripe_transfer_reversal_id = coalesce(stripe_transfer_reversal_id, p_stripe_transfer_reversal_id),
         attempts = attempts + 1,
         reversal_attempted_at = case when p_stripe_transfer_reversal_id is not null then now() else reversal_attempted_at end,
         status = case when p_error is not null then 'failed'::public.refund_status
                       when status = 'failed' then 'pending' else status end,
         failure_reason = p_error
   where id = p_refund_id and status <> 'succeeded';
end
$$;

-- Webhook（charge.refunded）で Stripe の返金が成功したことを確かめたとき。
-- 差し戻しも済んでいれば succeeded にする。今回 succeeded にしたら true（返金完了のメールを送る）。
create or replace function public.mark_refund_succeeded(p_refund_id uuid, p_stripe_refund_id text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  changed boolean;
begin
  update public.refunds
     set status = 'succeeded', completed_at = now(), failure_reason = null,
         stripe_refund_id = coalesce(stripe_refund_id, p_stripe_refund_id)
   where id = p_refund_id
     and status <> 'succeeded'
     and (transfer_reversal_amount = 0 or stripe_transfer_reversal_id is not null)
  returning true into changed;
  return coalesce(changed, false);
end
$$;

revoke all on function public.record_refund_progress(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_refund_succeeded(uuid, text) from public, anon, authenticated;
grant execute on function public.record_refund_progress(uuid, text, text, text) to service_role;
grant execute on function public.mark_refund_succeeded(uuid, text) to service_role;

-- ===== 20261002000100_host_bookings_and_statements.sql =====
-- thippo: 貸出主センターの予約管理・売上・月次明細
-- SPEC §9。付録 D24（決済日の月で集計、キャンセルはキャンセルした日の月に調整）・D25。

-- ---------------------------------------------------------------------------
-- 予約一覧（貸出主）。利用者のプロフィールは RLS で読めないため、表示名だけを返す関数にする
-- ---------------------------------------------------------------------------
create or replace function public.host_bookings(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_space_id uuid default null,
  p_status public.booking_status default null,
  p_limit integer default 200,
  p_booking_id uuid default null
)
returns table (
  booking_id uuid,
  order_id uuid,
  order_number text,
  space_id uuid,
  space_name text,
  period_start timestamptz,
  period_end timestamptz,
  slots integer,
  total integer,
  status public.booking_status,
  cancelled_by public.cancel_actor,
  cancel_reason text,
  guest_name text,
  application_fee integer,
  refund_amount integer,
  transfer_reversal_amount integer
)
language sql stable security definer set search_path = '' as $$
  select b.id, o.id, o.order_number, s.id, s.name, lower(b.period), upper(b.period), b.slots, b.total, b.status,
         b.cancelled_by, b.cancel_reason, coalesce(p.display_name, '（未設定）'),
         f.application_fee, r.refund_amount, r.transfer_reversal_amount
  from public.bookings b
  join public.orders o on o.id = b.order_id
  join public.spaces s on s.id = b.space_id
  join public.profiles p on p.id = b.guest_id
  join public.booking_fees f on f.booking_id = b.id
  left join public.refunds r on r.booking_id = b.id
  where b.host_id in (
          select m.host_id from public.host_members m where m.user_id = auth.uid() and private.is_host_member(m.host_id)
        )
    and o.status = 'paid'
    and (p_from is null or upper(b.period) > p_from)
    and (p_to is null or lower(b.period) < p_to)
    and (p_space_id is null or b.space_id = p_space_id)
    and (p_status is null or b.status = p_status)
    and (p_booking_id is null or b.id = p_booking_id)
  order by lower(b.period)
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
$$;
revoke all on function public.host_bookings(timestamptz, timestamptz, uuid, public.booking_status, integer, uuid) from public, anon;
grant execute on function public.host_bookings(timestamptz, timestamptz, uuid, public.booking_status, integer, uuid) to authenticated;

-- 無断キャンセル（no_show）の記録。利用開始後の確定済みの予約だけ。返金なし・キャンセル回数に含めない（SPEC §8）
create or replace function public.record_no_show(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or not private.is_host_member(b.host_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if b.status <> 'confirmed' then
    raise exception 'booking_not_confirmed' using errcode = 'P0001';
  end if;
  if lower(b.period) > now() then
    raise exception 'booking_not_started' using errcode = 'P0001';
  end if;
  update public.bookings set status = 'no_show', no_show_recorded_at = now() where id = b.id;
  perform private.write_audit_log(auth.uid(), 'host.booking_no_show', 'bookings', b.id::text, '{}'::jsonb);
end
$$;
revoke all on function public.record_no_show(uuid) from public, anon;
grant execute on function public.record_no_show(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 月次の明細（D24）
-- 決済：注文が paid になった日（paid_at）の月に、予約ごとの利用料金・運営手数料・決済手数料（見込み）を計上する
-- キャンセル：返金を作った日の月に、返金額と手数料の変化を調整として計上する
--   全額返金：運営手数料 0 円・決済手数料は運営負担 → 決済時の手数料を取り消す
--   半額返金：運営手数料は 110 円/時間に変わる、決済手数料は貸出主負担のまま
--   返金なし：変化なし
-- ---------------------------------------------------------------------------
create or replace function private.month_range(p_month date)
returns tstzrange
language sql immutable as $$
  select tstzrange(
    (date_trunc('month', p_month)::timestamp) at time zone 'Asia/Tokyo',
    ((date_trunc('month', p_month) + interval '1 month')::timestamp) at time zone 'Asia/Tokyo',
    '[)'
  )
$$;

create or replace function private.statement_lines(p_host_id uuid, p_month date)
returns table (
  occurred_at timestamptz,
  kind text,
  booking_id uuid,
  order_number text,
  space_name text,
  gross integer,
  platform_fee_excl_tax integer,
  platform_fee_tax integer,
  stripe_fee integer,
  net integer
)
language sql stable security definer set search_path = '' as $$
  with m as (select private.month_range(p_month) as r),
  lines as (
    select o.paid_at as occurred_at, 'payment'::text as kind, b.id as booking_id, o.order_number, s.name as space_name,
           b.total as gross, f.platform_fee_excl_tax, f.platform_fee_tax, f.stripe_fee_estimated as stripe_fee
    from public.bookings b
    join public.orders o on o.id = b.order_id
    join public.booking_fees f on f.booking_id = b.id
    join public.spaces s on s.id = b.space_id
    cross join m
    where b.host_id = p_host_id and o.status = 'paid' and o.paid_at <@ m.r and b.status <> 'expired'
    union all
    select r.created_at, 'cancellation', b.id, o.order_number, s.name,
           -r.refund_amount,
           r.platform_fee_excl_tax - f.platform_fee_excl_tax,
           r.platform_fee_tax - f.platform_fee_tax,
           case when r.policy = 'full' then -f.stripe_fee_estimated else 0 end
    from public.refunds r
    join public.bookings b on b.id = r.booking_id
    join public.orders o on o.id = b.order_id
    join public.booking_fees f on f.booking_id = b.id
    join public.spaces s on s.id = b.space_id
    cross join m
    where b.host_id = p_host_id and r.created_at <@ m.r
  )
  select l.occurred_at, l.kind, l.booking_id, l.order_number, l.space_name, l.gross, l.platform_fee_excl_tax,
         l.platform_fee_tax, l.stripe_fee, l.gross - l.platform_fee_excl_tax - l.platform_fee_tax - l.stripe_fee
  from lines l
  order by l.occurred_at, l.kind desc
$$;

create or replace function public.host_statement_lines(p_host_id uuid, p_month date)
returns table (
  occurred_at timestamptz,
  kind text,
  booking_id uuid,
  order_number text,
  space_name text,
  gross integer,
  platform_fee_excl_tax integer,
  platform_fee_tax integer,
  stripe_fee integer,
  net integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- security definer の中では current_user は所有者になるため、JWT のロールで呼び出し元を見分ける。
  -- JWT がない（DB に直接つないだ運用者・定期実行）場合とサーバー（service_role）は許可する。
  if not (
    private.is_host_member(p_host_id)
    or private.is_admin()
    or coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role'
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from private.statement_lines(p_host_id, p_month);
end
$$;
revoke all on function public.host_statement_lines(uuid, date) from public, anon;
grant execute on function public.host_statement_lines(uuid, date) to authenticated, service_role;

create or replace function public.host_statement_summary(p_host_id uuid, p_month date)
returns table (gross integer, platform_fee_excl_tax integer, platform_fee_tax integer, stripe_fee integer, net integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.gross), 0)::integer, coalesce(sum(l.platform_fee_excl_tax), 0)::integer,
         coalesce(sum(l.platform_fee_tax), 0)::integer, coalesce(sum(l.stripe_fee), 0)::integer,
         coalesce(sum(l.net), 0)::integer
  from public.host_statement_lines(p_host_id, p_month) l
$$;
revoke all on function public.host_statement_summary(uuid, date) from public, anon;
grant execute on function public.host_statement_summary(uuid, date) to authenticated, service_role;

-- 月次明細の発行（運営管理・定期実行からサーバーが呼ぶ）。発行済みの月は作り直さない。
alter table public.monthly_statements add column document_number text unique;

create or replace function public.issue_monthly_statement(p_host_id uuid, p_month date, p_pdf_path text, p_document_number text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s record;
  new_id uuid;
begin
  if exists (
    select 1 from public.monthly_statements
    where host_id = p_host_id and month = date_trunc('month', p_month)::date and issued_at is not null
  ) then
    raise exception 'already_issued' using errcode = 'P0001';
  end if;
  select * into s from public.host_statement_summary(p_host_id, p_month);
  insert into public.monthly_statements
    (host_id, month, gross, platform_fee_excl_tax, platform_fee_tax, stripe_fee, net, pdf_path, issued_at, document_number)
  values
    (p_host_id, date_trunc('month', p_month)::date, s.gross, s.platform_fee_excl_tax, s.platform_fee_tax, s.stripe_fee,
     s.net, p_pdf_path, now(), p_document_number)
  on conflict (host_id, month) do update
    set gross = excluded.gross, platform_fee_excl_tax = excluded.platform_fee_excl_tax,
        platform_fee_tax = excluded.platform_fee_tax, stripe_fee = excluded.stripe_fee, net = excluded.net,
        pdf_path = excluded.pdf_path, issued_at = excluded.issued_at, document_number = excluded.document_number
  returning id into new_id;
  return new_id;
end
$$;
revoke all on function public.issue_monthly_statement(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.issue_monthly_statement(uuid, date, text, text) to service_role;

-- 月次明細の PDF（非公開。サーバーが service role で読み、担当者であることを確かめてから返す）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statements', 'statements', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 担当者（SPEC §9 アカウント設定）
-- ---------------------------------------------------------------------------
-- 同じ貸出主の担当者の一覧（profiles は RLS で他人の行を読めないため関数にする）
create or replace function public.host_member_list()
returns table (user_id uuid, display_name text, email text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.email, m.created_at
  from public.host_members m
  join public.profiles p on p.id = m.user_id
  where m.host_id in (
    select mm.host_id from public.host_members mm where mm.user_id = auth.uid() and private.is_host_member(mm.host_id)
  )
  order by m.created_at
$$;
revoke all on function public.host_member_list() from public, anon;
grant execute on function public.host_member_list() to authenticated;

-- 担当者の追加。サーバーが、追加する人を招待（inviteUserByEmail）してから service role で呼ぶ。
-- 招待したばかりの、ほかに何も持っていないアカウントだけを担当者にできる（付録 D6）。
create or replace function public.add_host_member(p_host_id uuid, p_inviter_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
begin
  if not exists (
    select 1 from public.host_members m join public.profiles p on p.id = m.user_id
    where m.host_id = p_host_id and m.user_id = p_inviter_id and p.role = 'host' and p.status = 'active'
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into prof from public.profiles where id = p_user_id for update;
  if not found or prof.role <> 'guest' or prof.identity_status <> 'unsubmitted' or prof.deleted_at is not null
     or exists (select 1 from public.orders o where o.guest_id = prof.id)
     or exists (select 1 from public.host_members m where m.user_id = prof.id) then
    raise exception 'email_already_registered' using errcode = 'P0001';
  end if;
  insert into public.host_members (host_id, user_id) values (p_host_id, p_user_id);
  update public.profiles set role = 'host' where id = p_user_id;
  perform private.write_audit_log(p_inviter_id, 'host.member_added', 'host_members', p_user_id::text,
    jsonb_build_object('host_id', p_host_id));
end
$$;
revoke all on function public.add_host_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.add_host_member(uuid, uuid, uuid) to service_role;

-- ===== 20261003000100_admin.sql =====
-- thippo: 運営管理
-- SPEC §10。付録 D27（実質収入）・D28（停止しても確定済みの予約は残す）。
-- 状態を変える運営の操作は、すべてこの DB 関数で行い、同じトランザクションで audit_logs に記録する（SPEC §3.2）。

create or replace function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return auth.uid();
end
$$;

-- 利用者・貸出主の担当者のアカウント停止・再開（admin のアカウントは対象外）
create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_admin();
  prof public.profiles;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into prof from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if prof.role = 'admin' then
    raise exception 'cannot_change_admin' using errcode = 'P0001';
  end if;
  update public.profiles set status = p_status where id = p_user_id;
  perform private.write_audit_log(actor,
    case when p_status = 'suspended' then 'admin.user_suspend' else 'admin.user_reactivate' end,
    'profiles', p_user_id::text,
    jsonb_build_object('reason', reason, 'role', prof.role, 'previous_status', prof.status) || private.request_context());
end
$$;

-- 貸出主の停止・再開。停止すると公開中のスペースはすべて非公開（draft）にする（SPEC §10・D28）。
-- 再開しても自動では公開しない（貸出主が公開し直す）。
create or replace function public.admin_set_host_status(p_host_id uuid, p_status public.host_status, p_reason text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_admin();
  h public.hosts;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
  unpublished integer := 0;
begin
  if reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into h from public.hosts where id = p_host_id for update;
  if not found then
    raise exception 'host_not_found' using errcode = 'P0001';
  end if;
  update public.hosts set status = p_status where id = h.id;
  if p_status = 'suspended' then
    with u as (
      update public.spaces set status = 'draft'
      where host_id = h.id and status = 'published'
      returning 1
    ) select count(*)::integer into unpublished from u;
  end if;
  perform private.write_audit_log(actor,
    case when p_status = 'suspended' then 'admin.host_suspend' else 'admin.host_reactivate' end,
    'hosts', h.id::text,
    jsonb_build_object('reason', reason, 'previous_status', h.status, 'unpublished_spaces', unpublished)
      || private.request_context());
  return unpublished;
end
$$;

-- スペースの公開停止・解除。解除すると非公開（draft）に戻す
create or replace function public.admin_set_space_suspended(p_space_id uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_admin();
  s public.spaces;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into s from public.spaces where id = p_space_id for update;
  if not found then
    raise exception 'space_not_found' using errcode = 'P0001';
  end if;
  update public.spaces set status = case when p_suspended then 'suspended' else 'draft' end::public.space_status
  where id = s.id;
  perform private.write_audit_log(actor,
    case when p_suspended then 'admin.space_suspend' else 'admin.space_unsuspend' end,
    'spaces', s.id::text,
    jsonb_build_object('reason', reason, 'previous_status', s.status) || private.request_context());
end
$$;

-- アプリ側の運営の操作（書類の閲覧・明細の発行・返金の再実行など）の記録。
-- aal2 の admin が自分の操作として記録する（actor は JWT の利用者）。
create or replace function public.admin_record_action(
  p_action text, p_target_table text, p_target_id text, p_payload jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_admin();
begin
  if p_action !~ '^admin\.' then
    raise exception 'invalid audit action' using errcode = '22023';
  end if;
  return private.write_audit_log(actor, p_action, p_target_table, p_target_id,
    coalesce(p_payload, '{}'::jsonb) || private.request_context());
end
$$;

-- ---------------------------------------------------------------------------
-- 集計
-- ---------------------------------------------------------------------------
-- 運営のダッシュボードの月次の数字（D24 の基準・D27 の実質収入）
create or replace function public.admin_month_summary(p_month date)
returns table (
  booking_count integer,
  gross integer,
  platform_fee_excl_tax integer,
  platform_fee_tax integer,
  full_refund_stripe_fee integer,
  stripe_fee_estimated integer,
  stripe_fee_actual integer,
  stripe_fee_difference integer,
  net_income integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  r tstzrange := private.month_range(p_month);
  v_count integer;
  v_gross integer;
  v_fee integer;
  v_tax integer;
  v_burden integer;
  v_refunded integer;
  v_est integer;
  v_actual integer;
  v_diff integer;
begin
  perform private.require_admin();
  -- 決済（決済日の月）
  select count(*)::integer, coalesce(sum(b.total), 0)::integer
    into v_count, v_gross
  from public.bookings b join public.orders o on o.id = b.order_id
  where o.status = 'paid' and o.paid_at <@ r and b.status <> 'expired';

  -- 運営手数料は決済とキャンセルの調整を合わせる（貸出主の明細と同じ）
  select coalesce(sum(l.platform_fee_excl_tax), 0)::integer, coalesce(sum(l.platform_fee_tax), 0)::integer,
         coalesce(sum(case when l.kind = 'cancellation' then l.gross else 0 end), 0)::integer
    into v_fee, v_tax, v_refunded
  from public.hosts h cross join lateral private.statement_lines(h.id, p_month) l;
  v_gross := v_gross + v_refunded; -- 返金（マイナス）を差し引いた利用総額

  -- 全額返金で運営が負担した決済手数料（キャンセルした月）
  select coalesce(sum(f.stripe_fee_estimated), 0)::integer into v_burden
  from public.refunds rf join public.booking_fees f on f.booking_id = rf.booking_id
  where rf.policy = 'full' and rf.created_at <@ r;

  -- 決済手数料の見込み額と実額（決済日の月。実額が取れた注文だけで差額を出す）
  select coalesce(sum(o.application_fee_amount - fee.platform), 0)::integer,
         coalesce(sum(o.stripe_fee_actual), 0)::integer,
         coalesce(sum(o.stripe_fee_actual - (o.application_fee_amount - fee.platform)) filter (where o.stripe_fee_actual is not null), 0)::integer
    into v_est, v_actual, v_diff
  from public.orders o
  cross join lateral (
    select coalesce(sum(f.platform_fee_excl_tax + f.platform_fee_tax), 0) as platform
    from public.bookings b join public.booking_fees f on f.booking_id = b.id where b.order_id = o.id
  ) fee
  where o.status = 'paid' and o.paid_at <@ r;

  return query select v_count, v_gross, v_fee, v_tax, v_burden, v_est, v_actual, v_diff,
    v_fee - v_burden - v_diff;
end
$$;

-- 貸出主ごとの月次集計（明細の発行状況、決済手数料の見込み額と実額の差額つき）
create or replace function public.admin_host_month_summaries(p_month date)
returns table (
  host_id uuid,
  company_name text,
  gross integer,
  platform_fee_excl_tax integer,
  platform_fee_tax integer,
  stripe_fee integer,
  net integer,
  stripe_fee_actual integer,
  stripe_fee_difference integer,
  statement_issued_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select h.id, h.company_name, s.gross, s.platform_fee_excl_tax, s.platform_fee_tax, s.stripe_fee, s.net,
           a.actual, a.diff, ms.issued_at
    from public.hosts h
    cross join lateral (
      select coalesce(sum(l.gross), 0)::integer as gross, coalesce(sum(l.platform_fee_excl_tax), 0)::integer as platform_fee_excl_tax,
             coalesce(sum(l.platform_fee_tax), 0)::integer as platform_fee_tax, coalesce(sum(l.stripe_fee), 0)::integer as stripe_fee,
             coalesce(sum(l.net), 0)::integer as net, count(*) as n
      from private.statement_lines(h.id, p_month) l
    ) s
    cross join lateral (
      select coalesce(sum(o.stripe_fee_actual), 0)::integer as actual,
             coalesce(sum(o.stripe_fee_actual - (
               select coalesce(sum(f.stripe_fee_estimated), 0) from public.bookings b
               join public.booking_fees f on f.booking_id = b.id where b.order_id = o.id
             )) filter (where o.stripe_fee_actual is not null), 0)::integer as diff
      from public.orders o
      where o.host_id = h.id and o.status = 'paid' and o.paid_at <@ private.month_range(p_month)
    ) a
    left join public.monthly_statements ms on ms.host_id = h.id and ms.month = date_trunc('month', p_month)::date
    where s.n > 0 or ms.id is not null
    order by h.company_name;
end
$$;

-- キャンセル監視：過去30日・過去24時間のキャンセル回数が多い利用者
create or replace function public.admin_cancel_monitor(p_min_30d integer default 3, p_limit integer default 100)
returns table (user_id uuid, display_name text, email text, status public.account_status,
               cancels_24h integer, cancels_30d integer, last_cancel_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select p.id, p.display_name, p.email, p.status,
           count(*) filter (where e.created_at > now() - interval '24 hours')::integer,
           count(*)::integer,
           max(e.created_at)
    from public.cancel_events e join public.profiles p on p.id = e.user_id
    where e.created_at > now() - interval '30 days'
    group by p.id
    having count(*) >= p_min_30d or count(*) filter (where e.created_at > now() - interval '24 hours') >= 3
    order by count(*) filter (where e.created_at > now() - interval '24 hours') desc, count(*) desc
    limit p_limit;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_set_profile_status(uuid, public.account_status, text)',
    'public.admin_set_host_status(uuid, public.host_status, text)',
    'public.admin_set_space_suspended(uuid, boolean, text)',
    'public.admin_record_action(text, text, text, jsonb)',
    'public.admin_month_summary(date)',
    'public.admin_host_month_summaries(date)',
    'public.admin_cancel_monitor(integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function private.require_admin() from public;

-- ===== 20261004000100_jobs_and_contact.sql =====
-- thippo: 定期実行・リマインド・お問い合わせ
-- SPEC §7-9, §11, §12。付録 D30〜D33。定期実行の関数はサーバー（service_role）だけが呼ぶ。

alter table public.bookings
  add column reminder_day_before_sent_at timestamptz,
  add column reminder_2h_sent_at timestamptz;

create index bookings_confirmed_start_idx on public.bookings (lower(period)) where status = 'confirmed';

-- 利用終了時刻を過ぎた confirmed の予約を completed にする（SPEC §7-9。15分ごと）
create or replace function public.complete_finished_bookings()
returns integer
language sql security definer set search_path = '' as $$
  with u as (
    update public.bookings set status = 'completed'
    where status = 'confirmed' and upper(period) <= now()
    returning 1
  )
  select count(*)::integer from u
$$;

-- 前日のリマインド（D31）。p_date（東京時間）に始まる確定済みの予約のうち、未送信のものを「送信済み」にして返す。
create or replace function public.claim_day_before_reminders(p_date date, p_limit integer default 500)
returns table (booking_id uuid)
language sql security definer set search_path = '' as $$
  update public.bookings b set reminder_day_before_sent_at = now()
  where b.id in (
    select x.id from public.bookings x
    where x.status = 'confirmed'
      and x.reminder_day_before_sent_at is null
      and (lower(x.period) at time zone 'Asia/Tokyo')::date = p_date
    order by lower(x.period)
    limit p_limit
    for update skip locked
  )
  returning b.id
$$;

-- 利用開始2時間前のリマインド（D31）。開始まで2時間を切った確定済みの予約のうち、未送信のもの。
-- 利用開始の2時間前を過ぎてから支払われた予約は対象外（確定のメールで足りるため）。
create or replace function public.claim_two_hour_reminders(p_limit integer default 500)
returns table (booking_id uuid)
language sql security definer set search_path = '' as $$
  update public.bookings b set reminder_2h_sent_at = now()
  where b.id in (
    select x.id from public.bookings x
    join public.orders o on o.id = x.order_id
    where x.status = 'confirmed'
      and x.reminder_2h_sent_at is null
      and lower(x.period) > now()
      and lower(x.period) <= now() + interval '2 hours'
      and o.paid_at < lower(x.period) - interval '2 hours'
    order by lower(x.period)
    limit p_limit
    for update skip locked
  )
  returning b.id
$$;

-- 実際の Stripe 手数料を保存する（SPEC §5・§11。毎時）
create or replace function public.set_order_stripe_fee_actual(p_order_id uuid, p_fee integer)
returns void
language sql security definer set search_path = '' as $$
  update public.orders set stripe_fee_actual = p_fee where id = p_order_id and stripe_fee_actual is null
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.complete_finished_bookings()',
    'public.claim_day_before_reminders(date, integer)',
    'public.claim_two_hour_reminders(integer)',
    'public.set_order_stripe_fee_actual(uuid, integer)',
    'private.purge_rate_limit_counters()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 定期実行から呼ぶため、private の関数を service_role が呼べる公開の入口を用意する
create or replace function public.purge_rate_limit_counters() returns integer
language sql security definer set search_path = '' as $$
  select private.purge_rate_limit_counters()
$$;
revoke all on function public.purge_rate_limit_counters() from public, anon, authenticated;
grant execute on function public.purge_rate_limit_counters() to service_role;

-- ---------------------------------------------------------------------------
-- お問い合わせ（D32）
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  category text not null check (category in ('booking', 'account', 'host', 'other')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
grant select on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
create policy contact_messages_select_admin on public.contact_messages for select to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------
-- 本人確認書類の削除（SPEC §3.3・D33）
-- ---------------------------------------------------------------------------
-- 退会から p_retention_days 日を過ぎた利用者の書類。削除はサーバーがストレージから消したあと mark_identity_documents_purged で記録する。
create or replace function public.identity_documents_due_for_purge(p_retention_days integer, p_limit integer default 200)
returns table (document_id uuid, front_path text, back_path text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.front_path, d.back_path
  from public.identity_documents d
  join public.profiles p on p.id = d.user_id
  where d.purged_at is null
    and p.withdrawn_at is not null
    and p.withdrawn_at < now() - make_interval(days => p_retention_days)
  order by p.withdrawn_at
  limit p_limit
$$;

create or replace function public.mark_identity_documents_purged(p_document_ids uuid[])
returns void
language sql security definer set search_path = '' as $$
  update public.identity_documents set purged_at = now() where id = any (p_document_ids) and purged_at is null
$$;

-- 提出に使われず残ったファイル（アップロード後に提出しなかった・提出に失敗したもの）
create or replace function public.orphan_identity_files(p_older_than interval default interval '1 day', p_limit integer default 500)
returns table (name text)
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'identity-documents'
    and o.created_at < now() - p_older_than
    and not exists (
      select 1 from public.identity_documents d where d.front_path = o.name or d.back_path = o.name
    )
  limit p_limit
$$;

revoke all on function public.identity_documents_due_for_purge(integer, integer) from public, anon, authenticated;
revoke all on function public.mark_identity_documents_purged(uuid[]) from public, anon, authenticated;
revoke all on function public.orphan_identity_files(interval, integer) from public, anon, authenticated;
grant execute on function public.identity_documents_due_for_purge(integer, integer) to service_role;
grant execute on function public.mark_identity_documents_purged(uuid[]) to service_role;
grant execute on function public.orphan_identity_files(interval, integer) to service_role;

-- ===== 20261005000100_withdrawal.sql =====
-- thippo: 退会（付録 D36）
-- これからの予約（確定済み・支払い待ち）がある間は退会できない。退会後はログインできない（Auth 側でも止める）。
-- 退会日（withdrawn_at）は、本人確認書類の保存期間の起点になる（SPEC §3.3・D33）。

create or replace function public.withdraw_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
begin
  select * into prof from public.profiles where id = uid for update;
  if not found or prof.deleted_at is not null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if prof.role <> 'guest' then
    -- 貸出主の担当者・運営は運営に連絡して手続きする
    raise exception 'not_guest' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.guest_id = uid and b.status in ('pending', 'confirmed') and upper(b.period) > now()
  ) or exists (
    select 1 from public.orders o where o.guest_id = uid and o.status = 'pending'
  ) then
    raise exception 'has_upcoming_bookings' using errcode = 'P0001';
  end if;

  update public.profiles set withdrawn_at = now(), deleted_at = now() where id = uid;
  delete from public.cart_items ci using public.carts c where ci.cart_id = c.id and c.guest_id = uid;
  perform private.write_audit_log(uid, 'guest.withdraw', 'profiles', uid::text, '{}'::jsonb);
end
$$;
revoke all on function public.withdraw_account() from public, anon;
grant execute on function public.withdraw_account() to authenticated;

-- ===== 20261006000100_manual_mail.sql =====
-- thippo: メールを手作業で送る運用（付録 D39）
-- メール送信サービスを使わない間は、アプリが作ったメールを notifications に「送信待ち（queued）」で残し、
-- 運営が運営管理の画面で内容を確かめて、自分のメールソフトから送る。送ったら「送信済み」にする。
alter table public.notifications add column body text;

comment on column public.notifications.body is 'メールの本文。手作業で送るときに運営管理の画面に表示する';
