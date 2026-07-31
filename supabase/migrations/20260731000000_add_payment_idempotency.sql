alter table public.payments
  add column idempotency_key uuid not null default gen_random_uuid();

alter table public.payments
  add constraint payments_idempotency_key_unique
  unique (idempotency_key);

alter table public.payments
  alter column idempotency_key drop default;

create or replace function public.protect_payment_idempotency_key()
returns trigger
language plpgsql
as $$
begin
  if new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'idempotency_key is immutable.';
  end if;

  return new;
end;
$$;

create trigger protect_payment_idempotency_key_trigger
before update on public.payments
for each row execute function public.protect_payment_idempotency_key();
