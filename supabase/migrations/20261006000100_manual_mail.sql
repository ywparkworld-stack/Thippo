-- thippo: メールを手作業で送る運用（付録 D39）
-- メール送信サービスを使わない間は、アプリが作ったメールを notifications に「送信待ち（queued）」で残し、
-- 運営が運営管理の画面で内容を確かめて、自分のメールソフトから送る。送ったら「送信済み」にする。
alter table public.notifications add column body text;

comment on column public.notifications.body is 'メールの本文。手作業で送るときに運営管理の画面に表示する';
