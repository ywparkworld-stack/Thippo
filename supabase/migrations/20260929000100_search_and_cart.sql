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
