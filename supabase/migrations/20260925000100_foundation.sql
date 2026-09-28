-- thippo: 拡張機能・スキーマ・型・共通の関数
-- SPEC §4

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- RLS から呼ぶ補助関数や内部用のテーブルは、API（PostgREST）に公開しない private スキーマに置く。
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 列挙型
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('guest', 'host', 'admin');
create type public.identity_status as enum ('unsubmitted', 'pending', 'approved', 'rejected');
create type public.account_status as enum ('active', 'suspended');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.host_status as enum ('applied', 'active', 'suspended');
create type public.space_status as enum ('draft', 'published', 'suspended');
create type public.order_status as enum ('pending', 'paid', 'expired', 'failed');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.cancel_actor as enum ('guest', 'host', 'admin');
create type public.cancel_policy as enum ('full', 'half', 'none');
create type public.refund_status as enum ('pending', 'succeeded', 'failed');
create type public.notification_status as enum ('queued', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- 共通のトリガー関数
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- API 経由（anon / authenticated）のリクエストかどうか。
-- security definer の関数やサーバー（service_role）、DB を直接操作する運用者からの変更は false。
create or replace function private.is_api_user() returns boolean
language sql stable as $$
  select current_user in ('anon', 'authenticated')
$$;
