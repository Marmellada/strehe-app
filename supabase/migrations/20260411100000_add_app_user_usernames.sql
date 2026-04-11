alter table public.app_users
  add column if not exists username text;

with candidates as (
  select
    id,
    lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]', '', 'g')) as candidate_username,
    row_number() over (
      partition by lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]', '', 'g'))
      order by created_at, id
    ) as candidate_rank
  from public.app_users
  where username is null
    and email is not null
)
update public.app_users as target
set
  username = candidates.candidate_username,
  updated_at = now()
from candidates
where target.id = candidates.id
  and candidates.candidate_rank = 1
  and candidates.candidate_username <> '';

create unique index if not exists uq_app_users_username_lower
  on public.app_users (lower(username))
  where username is not null;
