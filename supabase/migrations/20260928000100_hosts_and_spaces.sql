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
