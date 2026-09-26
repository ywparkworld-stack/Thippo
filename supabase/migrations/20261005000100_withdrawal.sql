-- thippo: 退会（付録 D36）
-- これからの予約（確定済み・支払い待ち）がある間は退会できない。退会後はログインできない（Auth 側でも止める）。
-- 退会日（withdrawn_at）は、本人確認書類の保存期間の起点になる（SPEC §3.3・D33）。

create or replace function public.withdraw_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
begin
  select * into prof from public.profiles where id = uid for update;
  if not found or prof.deleted_at is not null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if prof.role <> 'guest' then
    -- 貸出主の担当者・運営は運営に連絡して手続きする
    raise exception 'not_guest' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.guest_id = uid and b.status in ('pending', 'confirmed') and upper(b.period) > now()
  ) or exists (
    select 1 from public.orders o where o.guest_id = uid and o.status = 'pending'
  ) then
    raise exception 'has_upcoming_bookings' using errcode = 'P0001';
  end if;

  update public.profiles set withdrawn_at = now(), deleted_at = now() where id = uid;
  delete from public.cart_items ci using public.carts c where ci.cart_id = c.id and c.guest_id = uid;
  perform private.write_audit_log(uid, 'guest.withdraw', 'profiles', uid::text, '{}'::jsonb);
end
$$;
revoke all on function public.withdraw_account() from public, anon;
grant execute on function public.withdraw_account() to authenticated;
