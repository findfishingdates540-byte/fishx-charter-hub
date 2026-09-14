alter table public.booking_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_duration_ms integer;

alter table public.business_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_duration_ms integer;

do $$ begin
  alter table public.booking_messages add constraint booking_messages_attachment_type_chk
    check (attachment_type is null or attachment_type in ('image','audio'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.business_messages add constraint business_messages_attachment_type_chk
    check (attachment_type is null or attachment_type in ('image','audio'));
exception when duplicate_object then null; end $$;

drop policy if exists "message media readable" on storage.objects;
create policy "message media readable" on storage.objects
  for select using (bucket_id = 'message-media');

drop policy if exists "message media upload own" on storage.objects;
create policy "message media upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "message media delete own" on storage.objects;
create policy "message media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'message-media' and (storage.foldername(name))[1] = auth.uid()::text);