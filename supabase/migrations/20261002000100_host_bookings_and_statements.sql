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
