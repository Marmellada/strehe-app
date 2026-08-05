# Rollback and Forward-Repair Plan

Prefer stopping before deployment, Vercel application rollback, and reviewed
forward database repair. Do not use destructive down migrations casually.

## 1. Migration fails before completion

Keep the baseline application active. Capture the error, migration history, and
locks. Confirm the transaction rolled back and pending objects remain absent.
Do not repair migration history. Retry only after cause review and unchanged
preconditions.

Database intervention: only if partial objects unexpectedly remain.

## 2. Migration succeeds but verification fails

Do not deploy. Preserve the committed database state. Determine whether a
reviewed forward migration can correct the discrepancy. Restore from the
verified backup only for integrity/data damage that cannot safely be repaired.

Application rollback alone is insufficient because deployment has not occurred.

## 3. Application deployment fails

Promote the last healthy Vercel deployment. Leave additive database changes in
place. The baseline application does not require their removal.

Database intervention: normally none.

## 4. Application deploys but funnel actions fail

Promote the last healthy Vercel deployment, stop funnel use, preserve logs, and
diagnose schema/API mismatch. Repair application code or database forward after
review.

## 5. RLS or privilege verification fails

Stop funnel access and deployment. Do not grant broad emergency access.
Apply a reviewed forward policy/GRANT correction. If exposure is possible,
disable the affected application path and begin security incident handling.

Database intervention: required.

## 6. Task-attachment policy causes unexpected denial

Keep the restrictive posture and pause affected attachment workflows. Compare
bucket IDs, identity helper behavior, and other policies. Use a forward policy
correction; removing the policy requires explicit security approval.

Application rollback may reduce usage but does not change the database policy.

## 7. Capacity trigger behaves incorrectly

Stop founding-offer creation. Inspect capacity row, active-offer count, trigger,
and function definition read-only. Do not manually edit the counter. Apply a
reviewed forward reconciliation migration or restore if integrity is damaged.

Database intervention: required.

## 8. Public contact regression appears

Promote the prior Vercel deployment. Keep email/WhatsApp fallback visible.
Confirm whether rows were saved before reporting errors to avoid duplicates.
Database intervention is needed only for grant/RLS failure, not UI copy/cache
failure.

## 9. Offer PDF fails

Disable or avoid the PDF action and use no unapproved manual contract substitute.
Promote the prior deployment if the failure is release-wide. Database rollback
is not required when saved offers remain intact.

## 10. Reporting counts are incorrect

Do not use reports for commercial decisions. Preserve source aggregates and
metric inputs. Roll back the application if the calculation is code-based; use
a reviewed forward migration only if stored milestone evidence is incorrect.
Never rewrite production milestones without a separately approved data repair.

## Restore threshold

Use verified backup restoration only for corruption, unrecoverable partial DDL,
or harmful data changes that cannot be corrected safely forward. Founder and
the named recovery operator must authorize restoration.
