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
