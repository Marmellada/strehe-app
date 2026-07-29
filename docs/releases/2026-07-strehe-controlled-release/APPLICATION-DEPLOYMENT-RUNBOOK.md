# Application Deployment Runbook

Execution requires separate Founder authorization after database verification.

## Source and history strategy

- Source branch: `fix/local-migration-replay-and-funnel-verification`
- Exact source commit:
  `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`
- Target/expected production branch: `main` (must be confirmed in Vercel)
- Planning branch is documentation only and must not be deployed as the RC.

Create a reviewed pull request from the exact RC branch. Prefer a fast-forward
merge if branch protection supports an approved PR with fast-forward-only
history; this makes the production source commit exactly the audited RC SHA.
If GitHub requires a merge commit, use a normal merge commit and verify its tree
is identical to the RC tree. Do not squash or rebase: both rewrite or collapse
the audited commit identities.

Remote branches that would be needed later:

- `fix/local-migration-replay-and-funnel-verification` at the exact RC SHA;
- optionally the planning branch for review, never as the deployment source.

## Required review checks

- Hermes release-package PASS
- Founder application-deployment GO
- Main and RC unchanged
- CI lint, TypeScript, unit/security, authenticated smoke, public smoke, build
- Database migrations applied and read-only verification PASS
- Branch protection approvals complete
- No unrelated files in the PR

## Vercel preflight

The local repository is not bound to a Vercel project, so an authorized operator
must verify in the dashboard:

- correct team and project;
- production branch is `main`;
- current production deployment ID and source commit;
- latest deployment is healthy;
- automatic production deployment behavior;
- rollback/promotion permission.

Confirm presence, target, and last-update metadata without exposing values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `SITE_URL`
- `CRON_SECRET`
- any enabled Resend/promotion-email variables
- any enabled Inspection Lab OpenAI variables

STOP on a missing critical variable or a production/preview target mismatch.

## Build and deployment

Expected build command:

```powershell
npm run build
```

Expected result: successful Next.js compilation, TypeScript, page-data
collection, and generation of 68 routes.

After the approved Git merge/fast-forward, observe the Vercel deployment. Do not
manually deploy an unreviewed working tree. Success requires:

- deployment source matches the approved production commit/tree;
- build succeeds;
- production domains attach to the new deployment;
- runtime/error logs show no new database, RLS, or server-action failures;
- Vercel reports Ready.

## Sequencing

1. Apply and verify database migrations.
2. Record Founder database PASS.
3. Merge/fast-forward the exact RC.
4. Observe Vercel deployment.
5. Perform read-only production smoke checks.
6. Request separate authorization before synthetic writes, public launch,
   onboarding, or paid acquisition.

Never deploy the application before its required database schema exists.

## Application rollback

If build or runtime verification fails, promote the recorded last healthy
Vercel deployment, expected to correspond to baseline `a308b63…`. Do not remove
the new database schema merely to roll back the application; the prior
application is compatible with the additive schema. Preserve logs and prepare a
new reviewed application commit.
