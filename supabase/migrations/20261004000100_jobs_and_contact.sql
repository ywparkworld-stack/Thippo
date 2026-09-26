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
