alter table public.promotion_campaigns
  add column if not exists applies_to text;

update public.promotion_campaigns
set applies_to = 'package_fee'
where applies_to is null;

alter table public.promotion_campaigns
  alter column applies_to set default 'package_fee';

alter table public.promotion_campaigns
  alter column applies_to set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotion_campaigns_applies_to_check'
      and conrelid = 'public.promotion_campaigns'::regclass
  ) then
    alter table public.promotion_campaigns
      add constraint promotion_campaigns_applies_to_check
      check (applies_to in ('package_fee', 'service_lines', 'both'));
  end if;
end $$;
