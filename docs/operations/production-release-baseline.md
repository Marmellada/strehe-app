# STREHË Production Release Baseline

## Authoritative production record

| Field | Value |
| --- | --- |
| Application | STREHË |
| Environment | Production |
| Authoritative branch | `main` |
| Deployed commit | `a308b63a5fad0521057b42ecd763dff22c00e716` |
| Source tree | `e94a73e7fd474ebdfceb00f73aa4d4e306254b18` |
| Deployment date | 2026-07-22 |
| Deployment provider | Vercel |
| Deployment result | Successful |
| Production domains | `www.streheprona.com`, `app.streheprona.com` |
| Evidence | GitHub Deployment API and successful Vercel commit status |

The GitHub production deployment record identifies commit `a308b63` as the
successful production deployment. Read-only checks against the production
domains and the deployment-specific Vercel surface confirmed:

- a multilingual public route returns HTTP 200;
- the contact page and its honeypot field render;
- the login page returns HTTP 200;
- unauthenticated access to the task-generation cron route returns HTTP 401.

No contact form was submitted during verification.

## Phase 1 relationship

The Phase 1 review branch ends at
`daf916ba4746a3dd6535009fe62029123aba04af`. Its final source tree is
`e94a73e7fd474ebdfceb00f73aa4d4e306254b18`, exactly the same tree as the
production commit.

Phase 1 was squash-merged into `main` as `a308b63`.

**Do not merge `security/phase-1-launch-hardening` again.** Doing so would add
duplicate history without adding source changes.

## Known unresolved items

- Vercel Firewall rate-limit configuration requires separate verification.
- Production database migration state is not established by Git history alone.
- Dirty and untracked work from `qwen-inspection-lab-drafts` has been preserved
  externally but remains unapproved for the launch baseline.

## Release discipline

Future launch work must start from the authoritative `main` history or a clean
release branch created from the deployed commit. Experimental Qwen, household,
agent, Inspection Lab, database, PDF, email, and audit work must be reviewed and
approved as bounded packages before it is introduced.
