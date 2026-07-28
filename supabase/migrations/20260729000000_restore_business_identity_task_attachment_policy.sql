-- Remote history records 20260611120000 as applied and production contains its
-- related foundation objects, but this one restrictive policy is absent.
-- Restore the intended security behavior forward without changing remote
-- migration history.
drop policy if exists "Business identities gate task attachments"
  on storage.objects;

create policy "Business identities gate task attachments"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'task-attachments'
    or public.is_active_business_user()
  )
  with check (
    bucket_id <> 'task-attachments'
    or public.is_active_business_user()
  );
