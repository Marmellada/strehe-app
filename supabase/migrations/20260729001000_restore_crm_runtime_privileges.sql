-- Fresh replay creates these CRM tables without the CRUD grants present in
-- production. Restore only the runtime privileges required by authenticated RLS
-- policies and trusted service-role administration. Anonymous access remains
-- ungranted; public contact capture stays behind the server-side admin client.
grant select, insert, update, delete
  on table
    public.app_users,
    public.leads,
    public.lead_interactions,
    public.lead_events,
    public.promotion_campaigns,
    public.properties
  to authenticated, service_role;
