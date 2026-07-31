-- Replace all overlapping invoice and invoice-item authorization policies.

drop policy if exists "Authenticated users can delete" on public.invoices;
drop policy if exists "Authenticated users can delete draft invoices only" on public.invoices;
drop policy if exists "Authenticated users can delete invoices" on public.invoices;
drop policy if exists "Authenticated users can insert" on public.invoices;
drop policy if exists "Authenticated users can insert invoices" on public.invoices;
drop policy if exists "Authenticated users can read invoices" on public.invoices;
drop policy if exists "Authenticated users can select" on public.invoices;
drop policy if exists "Authenticated users can update" on public.invoices;
drop policy if exists "Authenticated users can update invoices" on public.invoices;
drop policy if exists "Business identity boundary" on public.invoices;
drop policy if exists "Office and admins can read invoices" on public.invoices;
drop policy if exists "Office and admins can insert invoices" on public.invoices;
drop policy if exists "Office and admins can update invoices" on public.invoices;
drop policy if exists "Office and admins can delete draft invoices" on public.invoices;
drop policy if exists "Billing admins can select invoices" on public.invoices;
drop policy if exists "Billing admins can insert invoices" on public.invoices;
drop policy if exists "Billing admins can update invoices" on public.invoices;
drop policy if exists "Billing admins can delete draft invoices" on public.invoices;

create policy "Billing admins can select invoices"
  on public.invoices
  for select
  to authenticated
  using (public.can_manage_billing());

create policy "Billing admins can insert invoices"
  on public.invoices
  for insert
  to authenticated
  with check (public.can_manage_billing());

create policy "Billing admins can update invoices"
  on public.invoices
  for update
  to authenticated
  using (public.can_manage_billing())
  with check (public.can_manage_billing());

create policy "Billing admins can delete draft invoices"
  on public.invoices
  for delete
  to authenticated
  using (
    public.can_manage_billing()
    and status = 'draft'
  );

drop policy if exists "Authenticated users can delete" on public.invoice_items;
drop policy if exists "Authenticated users can delete invoice items" on public.invoice_items;
drop policy if exists "Authenticated users can insert" on public.invoice_items;
drop policy if exists "Authenticated users can insert invoice items" on public.invoice_items;
drop policy if exists "Authenticated users can read invoice items" on public.invoice_items;
drop policy if exists "Authenticated users can select" on public.invoice_items;
drop policy if exists "Authenticated users can update" on public.invoice_items;
drop policy if exists "Authenticated users can update invoice items" on public.invoice_items;
drop policy if exists "Business identity boundary" on public.invoice_items;
drop policy if exists "Office and admins can read invoice items" on public.invoice_items;
drop policy if exists "Office and admins can insert draft invoice items" on public.invoice_items;
drop policy if exists "Office and admins can update draft invoice items" on public.invoice_items;
drop policy if exists "Office and admins can delete draft invoice items" on public.invoice_items;
drop policy if exists "Billing admins can select invoice items" on public.invoice_items;
drop policy if exists "Billing admins can insert draft invoice items" on public.invoice_items;
drop policy if exists "Billing admins can update draft invoice items" on public.invoice_items;
drop policy if exists "Billing admins can delete draft invoice items" on public.invoice_items;

create policy "Billing admins can select invoice items"
  on public.invoice_items
  for select
  to authenticated
  using (public.can_manage_billing());

create policy "Billing admins can insert draft invoice items"
  on public.invoice_items
  for insert
  to authenticated
  with check (
    public.can_manage_billing()
    and exists (
      select 1
      from public.invoices as parent_invoice
      where parent_invoice.id = invoice_items.invoice_id
        and parent_invoice.status = 'draft'
    )
  );

create policy "Billing admins can update draft invoice items"
  on public.invoice_items
  for update
  to authenticated
  using (
    public.can_manage_billing()
    and exists (
      select 1
      from public.invoices as parent_invoice
      where parent_invoice.id = invoice_items.invoice_id
        and parent_invoice.status = 'draft'
    )
  )
  with check (
    public.can_manage_billing()
    and exists (
      select 1
      from public.invoices as parent_invoice
      where parent_invoice.id = invoice_items.invoice_id
        and parent_invoice.status = 'draft'
    )
  );

create policy "Billing admins can delete draft invoice items"
  on public.invoice_items
  for delete
  to authenticated
  using (
    public.can_manage_billing()
    and exists (
      select 1
      from public.invoices as parent_invoice
      where parent_invoice.id = invoice_items.invoice_id
        and parent_invoice.status = 'draft'
    )
  );

grant select, insert, update, delete
  on table public.invoices, public.invoice_items
  to authenticated;

revoke select, insert, update, delete, truncate
  on table public.invoices, public.invoice_items
  from anon, service_role;

revoke truncate
  on table public.invoices, public.invoice_items
  from authenticated;
