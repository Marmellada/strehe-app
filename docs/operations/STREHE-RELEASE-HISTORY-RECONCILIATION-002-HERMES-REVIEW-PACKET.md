# STREHE Release History Reconciliation 002 — Hermes Review Packet

Date: 2026-08-06

Classification requested: selective local history reconciliation

Repository: `D:\Personal\Projects\Strehe-Prona\strehe-app-launch`

## Result

The authorized selective reconciliation completed successfully on local branch
`codex/reconcile-release-history-selective-b1`.

- Merge commit: `61338f66478e297fd8d955ba423c3a5524aa2eab`
- Merge tree: `6510ac93845034645a824e4b0c3b61ea837234b4`
- Parent 1 (authoritative current-production+B-1 candidate): `34e518cddc57107d90cd07f9881eda6ea49cbc8c`
- Parent 2 (historical controlled-release branch): `403ebd4ee55c1a6963675195cc3a0edc13d23f5d`
- Merge base: `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`
- Commit subject: `chore: preserve controlled release history on current production`

The review packet is a documentation-only follow-up to the merge commit so it can
record the merge commit and tree identifiers without amending or rewriting either
parent or the merge itself.

## Preflight

The worktree was clean before reconciliation. After fetching the latest remote
state, all authorized references matched:

- `origin/main`: `b9ec62d55df8a880b985283928fec21b716deb5c`
- candidate commit: `34e518cddc57107d90cd07f9881eda6ea49cbc8c`
- candidate tree: `6241e33c3ba1245806c9299e3a2784192cca31e1`
- historical release branch: `403ebd4ee55c1a6963675195cc3a0edc13d23f5d`
- recovery branch: `ff6a1f8fe0f8d8a7b17b4c84c769a14e4304be30`
- common base: `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`

The release-only range contained exactly six commits and 16 unique changed paths.
The only non-Markdown path was `scripts/production-release-preflight.sql`.

## Release-only commit and changed-path inventory

1. `20c62f8956b1341b3d79a221a746935751871044` — `chore: add production release preflight`
   - Added `scripts/production-release-preflight.sql`.
2. `4ae13cb1d8b6922f7a2f2fc51b0feef9d90fa5b5` — `docs: prepare controlled production release package`
   - Added `APPLICATION-DEPLOYMENT-RUNBOOK.md`.
   - Added `BACKUP-RECOVERY-CHECKLIST.md`.
   - Added `COMMERCIAL-LEGAL-GATES.md`.
   - Added `GO-NO-GO-CHECKLIST.md`.
   - Added `MIGRATION-RUNBOOK.md`.
   - Added `PENDING-MIGRATIONS.md`.
   - Added `POST-DEPLOYMENT-SMOKE.md`.
   - Added `POST-MIGRATION-VERIFICATION.md`.
   - Added `PRODUCTION-PREFLIGHT.md`.
   - Added `RELEASE-EVIDENCE-INDEX.md`.
   - Added `RELEASE-MANIFEST.md`.
   - Added `ROLLBACK-AND-FORWARD-REPAIR.md`.
3. `130666e61cef60a52c9b7e89e404c77fa0225bf1` — `Record STREHË production preflight evidence`
   - Modified `APPLICATION-DEPLOYMENT-RUNBOOK.md`.
   - Modified `BACKUP-RECOVERY-CHECKLIST.md`.
   - Modified `COMMERCIAL-LEGAL-GATES.md`.
   - Modified `GO-NO-GO-CHECKLIST.md`.
   - Added `PRODUCTION-EVIDENCE-2026-07-29.md`.
   - Modified `PRODUCTION-PREFLIGHT.md`.
   - Modified `RELEASE-EVIDENCE-INDEX.md`.
   - Modified `scripts/production-release-preflight.sql`.
4. `f16b8c5027655f14fdc95dc10a202fb78957be3e` — `Record STREHË production database migration evidence`
   - Modified `GO-NO-GO-CHECKLIST.md`.
   - Added `PRODUCTION-DATABASE-MIGRATION-2026-07-30.md`.
   - Modified `RELEASE-EVIDENCE-INDEX.md`.
5. `d2f20db495a740fb83f49e7de1889b8ba1267084` — `Record STREHË production database migration result`
   - Modified `GO-NO-GO-CHECKLIST.md`.
   - Modified `PRODUCTION-DATABASE-MIGRATION-2026-07-30.md`.
   - Modified `RELEASE-EVIDENCE-INDEX.md`.
6. `403ebd4ee55c1a6963675195cc3a0edc13d23f5d` — `docs: record controlled production application deployment`
   - Modified `GO-NO-GO-CHECKLIST.md`.
   - Added `PRODUCTION-APPLICATION-DEPLOYMENT-2026-07-30.md`.
   - Modified `RELEASE-EVIDENCE-INDEX.md`.

Except where explicitly shown as the SQL path, every filename in this inventory is
under `docs/releases/2026-07-strehe-controlled-release/`.

## Selective merge method

The authorized candidate tree was treated as authoritative. The commands used were:

```text
git switch -c codex/reconcile-release-history-selective-b1 34e518cddc57107d90cd07f9881eda6ea49cbc8c
git merge -s ours --no-commit release/strehe-controlled-production-plan
git restore --source=release/strehe-controlled-production-plan --staged --worktree -- <the 15 verified Markdown paths listed below>
git commit -m "chore: preserve controlled release history on current production"
```

No conflict occurred. Before the commit, the index contained exactly the 15
authorized Markdown files and no unresolved paths.

## Imported Markdown files

All paths below are under `docs/releases/2026-07-strehe-controlled-release/` and
their staged blobs were verified to match the historical release branch exactly:

1. `APPLICATION-DEPLOYMENT-RUNBOOK.md`
2. `BACKUP-RECOVERY-CHECKLIST.md`
3. `COMMERCIAL-LEGAL-GATES.md`
4. `GO-NO-GO-CHECKLIST.md`
5. `MIGRATION-RUNBOOK.md`
6. `PENDING-MIGRATIONS.md`
7. `POST-DEPLOYMENT-SMOKE.md`
8. `POST-MIGRATION-VERIFICATION.md`
9. `PRODUCTION-APPLICATION-DEPLOYMENT-2026-07-30.md`
10. `PRODUCTION-DATABASE-MIGRATION-2026-07-30.md`
11. `PRODUCTION-EVIDENCE-2026-07-29.md`
12. `PRODUCTION-PREFLIGHT.md`
13. `RELEASE-EVIDENCE-INDEX.md`
14. `RELEASE-MANIFEST.md`
15. `ROLLBACK-AND-FORWARD-REPAIR.md`

The documents were imported without correction or rewriting.

## SQL exclusion

`scripts/production-release-preflight.sql` is present in the historical second-parent
ancestry but absent from candidate `34e518cddc57107d90cd07f9881eda6ea49cbc8c`.
It was intentionally not restored, so it remains absent from merge tree
`6510ac93845034645a824e4b0c3b61ea837234b4`. This preserves its historical record
without introducing an unauthorized SQL or migration artifact into the current tree.

## Tree, identity, ancestry, and recovery verification

- The effective first-parent diff from `34e518cddc57107d90cd07f9881eda6ea49cbc8c`
  contains exactly the 15 Markdown files listed above.
- The effective diff contains zero paths outside
  `docs/releases/2026-07-strehe-controlled-release/`.
- All eight paths changed by the Hermes-reviewed B-1 candidate were compared by Git
  blob ID and are byte-identical to candidate `34e518cddc57107d90cd07f9881eda6ea49cbc8c`.
- `scripts/production-release-preflight.sql` is absent in both the candidate and the
  merge tree.
- The merge has exactly the two authorized parents, in the authorized order.
- `c8ed95a`, `1e3cd0e`, `043ec70`, `b9ec62d`, `34e518c`, and `403ebd4` are all
  ancestors of the merge.
- Recovery commit `ff6a1f8fe0f8d8a7b17b4c84c769a14e4304be30` is not an ancestor.
- None of the 14 `STREHE-RT-003-*` or `STREHE-RT-005-*` Markdown files introduced by
  the recovery commit exists in the merge tree. No content was restored from the
  recovery branch.

## Automated verification

- Secret-shaped-value scan: passed; 15 Markdown files scanned, zero findings.
- TypeScript: `npx tsc --noEmit` passed.
- Focused ESLint passed for:
  - `lib/actions/public-contact.ts`
  - `lib/security/public-contact.ts`
  - `lib/email/inquiry-notification-email.ts`
  - `tests/unit/public-contact.spec.ts`
  - `tests/unit/inquiry-notification-email.spec.ts`
- Production build: `npm run build` passed with Next.js 16.2.11; compilation,
  TypeScript, page-data collection, and generation of 68 static pages completed.
- The build used local non-production placeholder configuration. No secret value was
  printed or recorded.

## Restrictions and production safety

No branch was pushed. Neither `release/strehe-controlled-production-plan` nor
`origin/main` was updated. No deployment, production access, production inquiry,
database migration, manual data mutation, billing/payment change, offer-lifecycle
change, secret creation/rotation, environment/configuration change, or other
production mutation occurred.

## Review disposition

The local candidate preserves the authoritative current-production+B-1 application
tree, adds only the authorized historical Markdown records, preserves both histories
through the exact two-parent merge, excludes the SQL preflight script from the
current tree, and excludes the recovery branch and its 14 documents.
