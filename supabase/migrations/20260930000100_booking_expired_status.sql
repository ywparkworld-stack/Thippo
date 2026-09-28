-- thippo: 期限切れの予約の状態
-- pending のまま15分経った注文を expired にするとき、その予約も枠を解放する必要がある（SPEC §7-4）。
-- cancelled（キャンセル）とは区別するため、予約にも expired を追加する。
alter type public.booking_status add value if not exists 'expired' after 'pending';
