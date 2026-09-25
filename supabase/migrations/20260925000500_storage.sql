-- thippo: ストレージ
-- 本人確認書類は非公開バケット。パスは <user_id>/<ファイル名>。
-- 閲覧できるのは本人だけ。admin はサーバーが service_role で発行する有効期限の短い署名付き URL で閲覧し、
-- 閲覧したことを audit_logs に記録する（SPEC §3.3）。そのため admin 向けのポリシーは作らない。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('identity-documents', 'identity-documents', false, 10485760,
    array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']),
  ('space-photos', 'space-photos', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 本人確認書類
create policy identity_documents_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy identity_documents_owner_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.is_active_guest()
  );

-- スペースの写真（公開バケット。パスは <space_id>/<ファイル名>。書き込みはその貸出主の担当者のみ）
create policy space_photos_member_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'space-photos'
    and private.is_host_member(private.space_host_id(((storage.foldername(name))[1])::uuid))
  );

create policy space_photos_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'space-photos'
    and private.is_host_member(private.space_host_id(((storage.foldername(name))[1])::uuid))
  );
