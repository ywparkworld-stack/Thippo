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
