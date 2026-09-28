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
