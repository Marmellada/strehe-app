# STREHE-RELEASE-006 Codex Application Deployment Result

## Executive classification

**APPLICATION DEPLOYMENT PASS — READY FOR HERMES POST-DEPLOYMENT REVIEW**

The exact frozen release candidate
`eb30d0ec0f698bfd3a7c0404b519e67e38718f97` was advanced to `main` by
fast-forward only, pushed once, automatically deployed by Vercel, and verified
with bounded read-only production checks. This result does not authorize public
launch, onboarding, service delivery, or paid acquisition.

## Starting state and stop gate

- Repository:
  `D:\Personal\Projects\Strehe-Prona\strehe-app-phase1-security`
- Starting branch: `security/phase-1-launch-hardening`
- Starting HEAD: `daf916ba4746a3dd6535009fe62029123aba04af`
- Starting worktree: clean
- Active Git operation: none
- Fresh `origin/main`:
  `a308b63a5fad0521057b42ecd763dff22c00e716`
- Frozen RC:
  `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`
- RC tree: `9d9aea962a1d0d7d4c6b4a3b9cc1677c62b61b79`
- Baseline is an ancestor of the RC: PASS
- Fast-forward eligibility: PASS
- Baseline-to-RC range: 10 commits, 0 merge commits
- Planning HEAD excluded from production:
  `d2f20db495a740fb83f49e7de1889b8ba1267084`
- Application diff scope: exactly the 45 paths frozen in
  `RELEASE-MANIFEST.md`; no missing or unexpected path. The exact name-status
  inventory is preserved as `machine/baseline-to-rc-name-status.txt`.
- Vercel account: `milotberisha-9215`
- Vercel project: `strehe-app-9lf1`
- Project ID: `prj_pnHvdbxVAK1pqstHXAHhp4wn5Tes`
- Production source branch: `main`
- Pre-push production deployment:
  `dpl_E1YgwMrbRMjaDHPN5MFPXXwxTT4x`
- Pre-push production source:
  `a308b63a5fad0521057b42ecd763dff22c00e716`
- Queued/building deployments before push: 0
- Local migration/database-tool processes before push: 0

The pre-deployment stop gate passed without repair, rebase, force, replacement
RC, or unrelated change.

## Authorized Git operation

All listed commands exited `0`.

| Command | Result |
| --- | --- |
| `git switch main` | Existing local `main` selected |
| `git merge --ff-only origin/main` | Local `main` advanced to exact baseline |
| `git merge --ff-only eb30d0ec0f698bfd3a7c0404b519e67e38718f97` | Local `main` advanced to exact frozen RC |
| `git push origin main:main` | One non-force push; only `main` advanced |
| `git fetch origin main` | Independent post-push fetch succeeded |
| `git ls-remote origin refs/heads/main` | Independent remote hash matched RC |

Push window: `2026-07-29T23:39:13.0461252Z` through
`2026-07-29T23:39:17.5480484Z`.

Final local `main`, `origin/main`, and independent remote `main`:
`eb30d0ec0f698bfd3a7c0404b519e67e38718f97`.

No merge commit was created, no tag was pushed, and the planning branch was not
pushed.

## Vercel production deployment

- Deployment ID: `dpl_GEctFMo1oRc7Tdv23aWrTyDHkEck`
- Deployment URL:
  `strehe-app-9lf1-11qj3zbxf-milotberisha-9215s-projects.vercel.app`
- Environment: Production
- Source branch: `main`
- Source commit:
  `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`
- Created: `2026-07-29T23:39:21.928Z`
- Building: `2026-07-29T23:39:23.101Z`
- Ready: `2026-07-29T23:40:36.101Z`
- Final state: `READY`
- Previous rollback deployment retained:
  `dpl_E1YgwMrbRMjaDHPN5MFPXXwxTT4x`
- Rollback performed: no

Vercel attached all authorized aliases to the new deployment:

- `streheprona.com`
- `www.streheprona.com`
- `app.streheprona.com`

The build completed in 60 seconds, deployment output completed, and the CLI
reported `Ready`. Sanitized build logs contained no build, schema,
authorization, or release-blocking runtime error. A lexical scan matched the
valid route name `/unauthorized`; it was not an error message. Vercel returned
100 recent runtime events after the smoke checks and zero error-level events.

The nine required production environment-variable names remained present as
encrypted entries. No value was fetched or recorded.

One local `vercel inspect --wait` observation wrapper was terminated by its
outer 14-second watchdog while Vercel was still building. It neither failed nor
retriggered the deployment. Short read-only polling subsequently proved the
platform deployment reached `READY`.

## Bounded read-only production verification

| Request | Final result |
| --- | --- |
| `https://streheprona.com/` | 200; expected redirect to `https://www.streheprona.com/sq` |
| `https://www.streheprona.com/` | 200; expected redirect to `/sq` |
| `https://app.streheprona.com/` | 200; expected redirect to `/auth/login?next=%2Fdashboard` |
| `https://streheprona.com/sq` | 200 at `www` Albanian page |
| `https://streheprona.com/en` | 200 at `www` English page |
| `https://streheprona.com/de` | 200 at `www` German page |
| `https://streheprona.com/auth/login` | 200 at application login |

Browser inspection confirmed the Albanian, English, and German pages rendered
their localized primary headings. The application entry rendered `Sign in`.
Across the inspected pages:

- no 404, 500, redirect loop, hydration failure, or missing critical asset was
  observed;
- all inspected images completed with nonzero natural width;
- scripts and stylesheets were present;
- no browser warning or error was recorded;
- no schema-mismatch, missing-relation, RLS, or authorization failure appeared;
- no form was submitted.

Authenticated internal navigation was not attempted because it was optional and
no need to access or alter an existing user session arose.

Non-blocking warning for later correction: the rendered `<html lang>` value was
`en` on the inspected `/sq` and `/de` routes even though their visible content
and headings were correctly localized. This did not affect availability or the
bounded release gate.

## Prohibited-action attestations

- No contact form was submitted.
- No lead, consultation, offer, founding-capacity reservation, payment, or
  other production record was created or modified.
- No synthetic production record was created.
- No database command, migration, schema change, policy change, grant change,
  or data operation occurred.
- No Vercel setting, environment value, domain, or firewall rule was changed.
- No second deployment was triggered.
- No application code or frozen-RC content was modified.
- No rebase, amend, cherry-pick, force-push, tag push, or planning-branch push
  occurred.
- No public launch, customer onboarding, service delivery, or paid acquisition
  occurred.

## Evidence

External preservation root:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-RELEASE-006-2026-07-30`

The external manifest records SHA-256, size, and relative path for every
preserved artifact. Key machine-readable evidence includes:

- `machine/git-stop-gate-summary.json`
- `machine/application-diff-scope.json`
- `machine/authorized-git-local-steps.json`
- `machine/git-push-main.json`
- `machine/post-push-independent-verification.json`
- `machine/vercel-production-env-assessment.json`
- `machine/vercel-logs-env-assessment.json`
- `machine/vercel-runtime-log-assessment.json`
- `machine/http-smoke-results.json`
- `machine/browser-smoke-results.json`
- `raw-safe/vercel-new-deployment-inspect.json`
- `raw-safe/vercel-build-logs.txt`
- `raw-safe/vercel-runtime-logs.jsonl`

## Required handoff

Recommendation to Hermes:

**Proceed with
`STREHE-RELEASE-006-HERMES-POST-DEPLOYMENT-REVIEW-001` and independently
verify the stop gate, exact fast-forward, final remote hash, Vercel source
commit/state/aliases, sanitized logs, bounded smoke evidence, absence of
production writes, rollback status, and evidence hashes. Do not infer
public-launch authorization from this PASS.**
