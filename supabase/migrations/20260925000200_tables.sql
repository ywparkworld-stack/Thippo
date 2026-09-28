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
