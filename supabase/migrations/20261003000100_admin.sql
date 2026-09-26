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
