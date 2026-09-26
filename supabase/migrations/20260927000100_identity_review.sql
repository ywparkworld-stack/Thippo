-- thippo: 本人確認書類の提出と審査
-- SPEC §3.3, §6, §10。付録 D10（原則は表面のみ、必要なら両面）・D11（何度でも再提出できる）。

create type public.identity_document_type as enum (
  'drivers_license',   -- 運転免許証
  'my_number_card',    -- マイナンバーカード（表面のみ。裏面の個人番号は受け付けない）
  'passport',          -- パスポート
  'residence_card'     -- 在留カード
);

-- 1行 = 1回の提出。表面は必須、裏面は運営が両面の提出を求めたときなど任意。
alter table public.identity_documents rename column storage_path to front_path;
alter table public.identity_documents rename constraint identity_documents_path_owner to identity_documents_front_owner;
alter table public.identity_documents
  add column document_type public.identity_document_type not null default 'drivers_license',
  add column back_path text unique,
  -- 却下したときに、次の提出で両面を求めるか
  add column back_side_requested boolean not null default false,
  add constraint identity_documents_back_owner
    check (back_path is null or split_part(back_path, '/', 1) = user_id::text),
  add constraint identity_documents_distinct_sides check (back_path is null or back_path <> front_path),
  add constraint identity_documents_no_my_number_back
    check (document_type <> 'my_number_card' or back_path is null),
  add constraint identity_documents_back_request_on_reject
    check (not back_side_requested or status = 'rejected');
alter table public.identity_documents alter column document_type drop default;

-- 審査中の提出は1人1件まで
create unique index identity_documents_one_pending on public.identity_documents (user_id) where status = 'pending';

-- 提出は DB 関数（submit_identity_document）だけで行う。ブラウザからの直接の insert はやめる。
drop policy identity_documents_insert_self on public.identity_documents;
revoke insert on public.identity_documents from authenticated;

-- ---------------------------------------------------------------------------
-- 提出
-- ---------------------------------------------------------------------------
-- ファイルは利用者がブラウザから自分のフォルダ（<user_id>/...）にアップロードしておき、そのパスを渡す。
-- エラーは message にコードを入れて返す（アプリ側で日本語に置き換える）。
create or replace function public.submit_identity_document(
  p_document_type public.identity_document_type,
  p_front_path text,
  p_back_path text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  last_doc public.identity_documents;
  new_id uuid;
  p text;
begin
  if uid is null or not private.is_active_guest() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- 同じ利用者の同時の提出を直列にする
  select * into prof from public.profiles where id = uid for update;
  if prof.identity_status = 'pending' then
    raise exception 'identity_already_pending' using errcode = 'P0001';
  end if;
  if prof.identity_status = 'approved' then
    raise exception 'identity_already_approved' using errcode = 'P0001';
  end if;

  if p_back_path = '' then p_back_path := null; end if;
  if p_document_type = 'my_number_card' and p_back_path is not null then
    raise exception 'my_number_back_not_allowed' using errcode = 'P0001';
  end if;

  select * into last_doc from public.identity_documents
   where user_id = uid order by submitted_at desc limit 1;
  if found and last_doc.status = 'rejected' and last_doc.back_side_requested and p_back_path is null then
    raise exception 'back_side_required' using errcode = 'P0001';
  end if;

  foreach p in array array_remove(array[p_front_path, p_back_path], null) loop
    if split_part(p, '/', 1) <> uid::text then
      raise exception 'invalid_path' using errcode = 'P0001';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'identity-documents' and o.name = p) then
      raise exception 'file_not_found' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.identity_documents d where d.front_path = p or d.back_path = p) then
      raise exception 'file_already_used' using errcode = 'P0001';
    end if;
  end loop;
  if p_back_path = p_front_path then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;

  insert into public.identity_documents (user_id, document_type, front_path, back_path)
  values (uid, p_document_type, p_front_path, p_back_path)
  returning id into new_id;

  update public.profiles set identity_status = 'pending' where id = uid;
  return new_id;
end
$$;
revoke all on function public.submit_identity_document(public.identity_document_type, text, text) from public, anon;
grant execute on function public.submit_identity_document(public.identity_document_type, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 審査（運営）
-- ---------------------------------------------------------------------------
create or replace function public.review_identity_document(
  p_document_id uuid,
  p_approve boolean,
  p_reject_reason text default null,
  p_request_back_side boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  doc public.identity_documents;
  reason text := nullif(btrim(coalesce(p_reject_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into doc from public.identity_documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found' using errcode = 'P0001';
  end if;
  if doc.status <> 'pending' then
    raise exception 'document_not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    update public.identity_documents
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = doc.id;
    update public.profiles set identity_status = 'approved' where id = doc.user_id;
  else
    if reason is null or char_length(reason) > 1000 then
      raise exception 'reject_reason_required' using errcode = 'P0001';
    end if;
    update public.identity_documents
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
           reject_reason = reason, back_side_requested = coalesce(p_request_back_side, false)
     where id = doc.id;
    update public.profiles set identity_status = 'rejected' where id = doc.user_id;
  end if;

  perform private.write_audit_log(
    auth.uid(),
    case when p_approve then 'identity.approve' else 'identity.reject' end,
    'identity_documents',
    doc.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'user_id', doc.user_id,
      'reject_reason', case when p_approve then null else reason end,
      'back_side_requested', case when p_approve then null else coalesce(p_request_back_side, false) end
    )) || private.request_context()
  );
end
$$;
revoke all on function public.review_identity_document(uuid, boolean, text, boolean) from public, anon;
grant execute on function public.review_identity_document(uuid, boolean, text, boolean) to authenticated;

-- 審査の一覧で利用者の名前・メールアドレスを表示するため、admin は profiles を読める（既存の profiles_select）。
