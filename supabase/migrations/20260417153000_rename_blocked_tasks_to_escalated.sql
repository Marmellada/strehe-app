begin;

update public.tasks
set status = 'escalated'
where status = 'blocked';

update public.task_reports
set status_at_submission = 'escalated'
where status_at_submission = 'blocked';

commit;
