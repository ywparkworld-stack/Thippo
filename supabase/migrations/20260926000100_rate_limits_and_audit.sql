-- thippo: レート制限と操作ログ
-- SPEC §3.2, §3.3。付録 D5。

-- ---------------------------------------------------------------------------
-- レート制限（固定窓のカウンター）
-- ---------------------------------------------------------------------------
create table private.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
create index rate_limit_counters_window_idx on private.rate_limit_counters (window_start);

-- 1回分を数え、上限を超えていないかを返す。上限を超えた回も数える（連打しても窓は延びない）。
-- サーバー（service_role）だけが呼べる。キーは "login:ip:203.0.113.1" のように呼び出し側で作る。
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  win_start timestamptz;
  n integer;
begin
  if p_key is null or char_length(p_key) = 0 or char_length(p_key) > 300 then
    raise exception 'invalid rate limit key' using errcode = '22023';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  win_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limit_counters as c (key, window_start, hits)
  values (p_key, win_start, 1)
  on conflict (key, window_start) do update set hits = c.hits + 1
  returning c.hits into n;
  return query select
    n <= p_limit,
    n,
    greatest(0, ceil(extract(epoch from (win_start + make_interval(secs => p_window_seconds) - now()))))::integer;
end
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- 古いカウンターの削除（定期実行から呼ぶ。フェーズ10）
create or replace function private.purge_rate_limit_counters() returns integer
language sql security definer set search_path = '' as $$
  with d as (
    delete from private.rate_limit_counters where window_start < now() - interval '1 day' returning 1
  )
  select count(*)::integer from d
$$;

-- ---------------------------------------------------------------------------
-- 操作ログ
-- ---------------------------------------------------------------------------
-- DB 関数（RPC）の中から、操作と同じトランザクションで記録するために使う。
create or replace function private.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_payload jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  new_id bigint;
begin
  if p_action is null or p_action !~ '^[a-z_]+(\.[a-z_]+)+$' then
    raise exception 'invalid audit action: %', p_action using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, action, target_table, target_id, payload)
  values (p_actor_id, p_action, p_target_table, p_target_id, coalesce(p_payload, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end
$$;
revoke all on function private.write_audit_log(uuid, text, text, text, jsonb) from public;

-- 操作者の識別に使う JWT の情報（aal など）を毎回 payload に残せるように、補助関数を用意する。
create or replace function private.request_context() returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'aal', auth.jwt() ->> 'aal',
    'session_id', auth.jwt() ->> 'session_id'
  ))
$$;
