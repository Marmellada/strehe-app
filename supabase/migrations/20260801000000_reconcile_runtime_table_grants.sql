-- Migration: 20260801000000_reconcile_runtime_table_grants.sql
-- Authenticated runtime privilege reconciliation.
-- No anonymous access. RLS remains the authoritative boundary.

grant select, insert, update, delete
  on table
    public.banks,
    public.expense_categories,
    public.expenses,
    public.invoices,
    public.packages,
    public.services,
    public.subscriptions,
    public.task_attachments,
    public.tasks,
    public.vendors,
    public.workers
  to authenticated;

grant select, insert
  on table public.payments
  to authenticated;

grant select
  on table
    public.worker_role_title_history,
    public.promotion_codes
  to authenticated;

grant select, insert
  on table public.tasks
  to service_role;
