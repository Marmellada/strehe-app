insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-logos',
  'company-logos',
  true,
  2097152,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read company logos'
  ) then
    create policy "Public can read company logos"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'company-logos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload company logos'
  ) then
    create policy "Authenticated users can upload company logos"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'company-logos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can update company logos'
  ) then
    create policy "Authenticated users can update company logos"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'company-logos')
      with check (bucket_id = 'company-logos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete company logos'
  ) then
    create policy "Authenticated users can delete company logos"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'company-logos');
  end if;
end $$;
