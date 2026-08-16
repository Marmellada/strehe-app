# STREHË Messaging Ingestion V1 — Controlled Rollout

Status: implemented, NOT activated. No production migration, no Supabase Cron
job, and no Vault secret were created during implementation.

## What is already active (no action)

- Raw webhook → `public.meta_webhook_events` → `meta_ingestion_queue` enqueue
  trigger (runs automatically once the migrations are applied).
- `/api/cron/meta-ingest` route (GET + POST) with Bearer `CRON_SECRET`
  authorization, ready but not scheduled anywhere.

## Hobby fallback (Supabase Cron) — manual rollout steps

Do NOT perform these until Founder authorizes activation. The authorization
secret must exist in Supabase Vault first; it is never hardcoded and never
committed to Git.

1. In Supabase Vault, create a secret named exactly:

   `meta_ingest_cron_secret`

   Set its value to the SAME value as the application `CRON_SECRET`
   environment variable (so the cron request is authorized). Do NOT paste the
   value into chat or logs.

2. After the secret exists, create the cron job (manual SQL, not a migration —
   it cannot be represented safely without the live secret):

   ```sql
   select cron.schedule(
     'meta-ingest-hobby-fallback',
     '* * * * *',
     $$
       select net.http_post(
         url := 'https://streheprona.com/api/cron/meta-ingest',
         headers := jsonb_build_object(
           'Authorization',
           'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'meta_ingest_cron_secret')
         )
       );
     $$
   );
   ```

3. Verify the route returns 200 and the queue drains (check `meta_ingestion_queue`
   for rows leaving `pending`/`processing`).

## Future Vercel Pro switch (do NOT activate now)

After upgrading to Vercel Pro:

1. Disable/remove the Supabase Cron job above (`select cron.unschedule('meta-ingest-hobby-fallback');`).
2. Add a Vercel Cron entry to `vercel.json`:

   ```json
   { "crons": [ { "path": "/api/cron/meta-ingest", "schedule": "* * * * *" } ] }
   ```

3. Existing `CRON_SECRET` authorizes the same route (GET path).
4. Deploy normally and verify job execution.
5. No ingestion code redesign is required.

## Security invariants

- `CRON_SECRET` is never hardcoded; no secret is committed to Git.
- `public.meta_webhook_events` permissions are unchanged (INSERT-only service_role).
- The claim RPC is the only read path into the raw journal, granted to
  `service_role` only.
- Queue error fields store generic classes/steps only — never message text,
  payload fragments, phone numbers, or external IDs.
