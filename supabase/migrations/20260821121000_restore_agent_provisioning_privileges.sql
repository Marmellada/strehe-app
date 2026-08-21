-- Restore the least-privilege service_role access required by the
-- offline GMK agent provisioning utility.
--
-- provision-agent.mjs uses a service_role Supabase client to create/update
-- agent_principals and agent_capabilities after creating the Auth identity.
-- Runtime agents do NOT use service_role.

grant select, insert, update
  on table public.agent_principals
  to service_role;

grant select, insert, update
  on table public.agent_capabilities
  to service_role;
