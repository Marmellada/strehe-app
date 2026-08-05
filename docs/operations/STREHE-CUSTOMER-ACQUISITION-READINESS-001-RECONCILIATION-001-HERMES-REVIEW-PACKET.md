# STREHE-CUSTOMER-ACQUISITION-READINESS-001-RECONCILIATION-001

Date: 2026-08-05

Prepared for: Hermes Agent

Classification: Ready for independent review

## Candidate identity

- Production baseline: `b9ec62d55df8a880b985283928fec21b716deb5c`
- Original Hermes-reviewed B-1 commit: `9f7538cb0d791c3ff2bdbae6b3d86c7604fa5671`
- Reconciliation branch: `codex/reconcile-b1-current-production`
- Required final subject: `fix: reconcile inquiry notifications with current production`
- Final candidate commit: the single commit at the reconciliation branch tip; its immutable SHA is recorded in the accompanying Codex handoff because a commit cannot contain its own SHA without changing that SHA.

## Reconciliation method

The repository was fetched and `origin/main` was verified at the exact authorized production baseline. The reconciliation branch was created directly from that commit. The original reviewed commit was applied with `git cherry-pick --no-commit`, then retained for one final reconciliation commit.

No conflict occurred. Production introduced no changes to any of the original seven B-1 paths between the original patch base and `b9ec62d`. Every applied B-1 file blob was verified identical to the corresponding blob in `9f7538c` before this packet was added.

## Semantic differences from the reviewed implementation

None. The B-1 implementation, tests, security-test configuration, and original review packet are byte-identical to the Hermes-reviewed versions. The only additional file is this reconciliation packet. The important difference is ancestry: the new candidate is based on current production, so the later production work remains in its history and tree.

## Exact changed files against production baseline

- `docs/operations/STREHE-CUSTOMER-ACQUISITION-READINESS-001-CODEX-FIX-001-HERMES-REVIEW-PACKET.md`
- `docs/operations/STREHE-CUSTOMER-ACQUISITION-READINESS-001-RECONCILIATION-001-HERMES-REVIEW-PACKET.md`
- `lib/actions/public-contact.ts`
- `lib/email/inquiry-notification-email.ts`
- `lib/security/public-contact.ts`
- `playwright.entry-security.config.ts`
- `tests/unit/inquiry-notification-email.spec.ts`
- `tests/unit/public-contact.spec.ts`

## Verification results

- `npx tsc --noEmit` — PASS.
- Focused ESLint on the three B-1 implementation files and two B-1 test files — PASS.
- B-1, public-contact security, and attribution/funnel Playwright run — PASS: 31 executable tests passed; 31 database-integration cases were skipped because no isolated local database was configured or authorized.
- `npm run test:security:contact` — PASS: 16 tests.
- `npm run test:smoke:public` — PASS on corrected isolated configuration: 6 tests, including Albanian-first routing, all three contact pages, language switching, and the current Albanian conversion content.
- The first public-smoke attempt used an incorrect local `NEXT_PUBLIC_APP_URL` and produced three expected link-configuration failures; no application behavior failed. It was corrected to the expected public URL and all six tests passed.
- `npm run build` with non-secret, isolated placeholder Supabase settings and expected public URLs — PASS: compilation, TypeScript, page-data collection, and all 68 static pages completed.

No real Resend request, production database request, production inquiry, or production-data access occurred during verification.

## B-1 security and failure isolation

- Notification remains strictly after a successful inquiry insert.
- Invalid, honeypot, duplicate, lookup-error, and insert-error paths cannot notify.
- Notification return failures, thrown exceptions, and logging exceptions cannot alter the persisted inquiry or customer success response.
- The recipient is read server-side from the STREHË company profile; the public form cannot set recipient, sender, reply-to, or routing.
- Existing `RESEND_API_KEY` and `PROMOTION_EMAIL_FROM` / `RESEND_FROM_EMAIL` behavior is reused. No environment variable or secret was added.
- Customer-controlled HTML is escaped in the operator message.
- Structured notification-failure logs contain only the event name, inquiry ID, and bounded reason; no customer contact information or submitted message is logged.
- The existing 15-minute equivalent-inquiry suppression remains unchanged.
- Resend receives `public-inquiry/<persisted-inquiry-id>` as the idempotency key.
- Locale, first-touch source, campaign name, UTM fields, click ID, and submission timestamp remain available in the notification when present.

## Preservation of later production behavior

The reconciliation baseline contains all four required production commits as ancestors:

- `c8ed95a` — offer-lifecycle database enforcement
- `1e3cd0e` — payment idempotency protection
- `043ec70` — runtime grants and billing-security hardening
- `b9ec62d` — Albanian website clarity and conversion

None of the paths introduced or modified by those commits is changed by the reconciliation. The migration, billing, payment, and Albanian marketing files remain byte-identical to `b9ec62d`. Static funnel/attribution checks, the multilingual public smoke suite, TypeScript, and the full production build pass on the reconciled tree.

## Scope and prohibited-action confirmation

- No recovery-branch document is present in the diff.
- No database migration, billing file, payment file, production configuration, environment file, Vercel link file, credential, generated secret, or unrelated localization file is changed.
- The stale release branch and recovery branch were not modified.
- No branch was pushed or merged into `origin/main`.
- No deployment, production inquiry, production-data access, database mutation, migration execution, billing change, payment change, secret change, or production mutation occurred.
