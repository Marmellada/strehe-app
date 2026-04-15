begin;

create policy "Authenticated users can upload inspection lab photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-attachments'
  and name like 'inspection-lab/bathroom-base-shot/%'
);

create policy "Authenticated users can update inspection lab photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-attachments'
  and name like 'inspection-lab/bathroom-base-shot/%'
)
with check (
  bucket_id = 'task-attachments'
  and name like 'inspection-lab/bathroom-base-shot/%'
);

create policy "Authenticated users can delete inspection lab photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-attachments'
  and name like 'inspection-lab/bathroom-base-shot/%'
);

commit;