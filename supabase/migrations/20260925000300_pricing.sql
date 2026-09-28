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
