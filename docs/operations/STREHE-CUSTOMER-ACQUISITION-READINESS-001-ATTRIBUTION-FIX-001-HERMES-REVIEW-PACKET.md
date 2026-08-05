# STREHE Customer Acquisition Readiness 001 — Attribution Fix 001 Hermes Review Packet

Date: 2026-08-06

## Result

The confirmed client-side contact-attribution rerender defect is fixed on local
branch `codex/fix-contact-attribution-rerender`, created from deployed baseline
`fd80f4330d1bd5b1a691bd1f4e7aadbca1b6ddd3`.

Required commit subject:
`fix: preserve contact attribution across rerenders`

The immutable candidate commit SHA is recorded in the accompanying Codex handoff.
A Git commit cannot contain its own SHA without changing that SHA, so the packet is
included in the same authorized commit and identifies the exact branch, base, tree
scope, and required subject instead of embedding a self-invalidating identifier.

## Confirmed root cause

The contact component originally captured browser attribution once after hydration
and wrote it directly into hidden input DOM values. The hidden inputs continued to
render empty `defaultValue` props except for `landing_locale`. Editing any controlled
customer field caused React to rerender the component and reconcile those hidden
inputs back to their rendered defaults. The effect did not rerun because `locale`
had not changed.

Consequently, the submitted `FormData` retained `landing_locale` but sent empty
campaign, UTM, referrer, and landing-page fields. Server normalization correctly
converted those empty strings to `null`; the database layer was not the cause.

## Implementation approach

`ContactRequestForm` now:

1. Defines the existing ten attribution field names once with a typed
   `ContactAttribution` record.
2. Initializes render-stable attribution state with the existing locale semantics.
3. Captures the current referrer, campaign/UTM parameters, click ID, locale, and full
   path-plus-query landing page after hydration.
4. Applies the existing per-field length limits without changing field names,
   normalization, or meaning.
5. Guards capture with a ref so subsequent rerenders or locale changes cannot replace
   the first captured landing context within the mounted form.
6. Schedules the browser-derived state update through a cancellable microtask, which
   is compatible with React Strict Mode and avoids a synchronous effect-state update.
7. Renders hidden inputs from the stable state using controlled read-only values.

No query parameters are reread at submission time. No cookie, browser storage,
database field, environment variable, dependency, or migration was added.

## Before and after data flow

Before:

`window/referrer -> one-time DOM value mutation -> controlled-field rerender -> empty rendered default -> empty FormData -> server null`

After:

`window/referrer -> guarded React attribution state -> every rendered hidden value -> stable FormData -> unchanged server normalization`

## Exact changed files

- `components/marketing/ContactRequestForm.tsx`
- `tests/e2e/public-website-smoke.spec.ts`
- `docs/operations/STREHE-CUSTOMER-ACQUISITION-READINESS-001-ATTRIBUTION-FIX-001-HERMES-REVIEW-PACKET.md`

No other path is included.

## Regression coverage

The real-browser public smoke suite now inspects the exact `FormData` produced by the
rendered contact form.

The Albanian UTM regression opens:

`/sq/contact?utm_source=production-smoke-test&utm_medium=controlled-deployment&utm_campaign=b1-notification`

It supplies a controlled referrer, waits for client initialization, edits every
controlled customer field, performs further edits, triggers server-side validation
feedback with a meaningful-field validation failure that stops before admin access,
and rechecks the serialized attribution after each rerender boundary.

The exact retained assertions are:

- `source_detail=https://partner.example/campaign`
- `campaign_name=b1-notification`
- `utm_source=production-smoke-test`
- `utm_medium=controlled-deployment`
- `utm_campaign=b1-notification`
- `landing_locale=sq`
- `landing_page=/sq/contact?utm_source=production-smoke-test&utm_medium=controlled-deployment&utm_campaign=b1-notification`

The suite also verifies a direct Albanian contact landing without UTM parameters:
campaign and UTM fields remain empty while `landing_locale=sq` and
`landing_page=/sq/contact` survive all controlled-field edits.

Cross-page UTM carry-forward is not part of the existing architecture: no contact
attribution cookie, session storage, local storage, or URL-propagation mechanism
exists. The authorization made that case conditional on existing support, so this
fix preserves the current direct-contact landing and referrer semantics without
introducing a new tracking architecture.

## Verification results

- TypeScript: `npx tsc --noEmit` — PASS.
- Focused ESLint covering the component, browser regression, public-contact action,
  security handler, notification sender, and their unit tests — PASS.
- Multilingual public smoke and attribution regression:
  `npm run test:smoke:public` — PASS, 8/8 tests.
- Public-contact security, attribution normalization, and B-1 notification tests:
  31/31 applicable tests passed. The existing 31 local-database lifecycle cases were
  skipped because their optional database harness was not configured; they are
  unrelated to the changed client component.
- Production build: `npm run build` — PASS with Next.js 16.2.11; compilation,
  TypeScript, page-data collection, and generation of 68 static pages completed.

All build and browser verification used isolated non-production placeholder
configuration. No production service or production record was accessed.

## B-1 and existing behavior preservation

The server action, validation schema, duplicate suppression, rate limiting,
normalization, database mapping, notification ordering, recipient control,
idempotency key, failure isolation, locale messages, pending state, and customer
success/failure behavior were not changed.

The B-1 sender and public-contact tests passed unchanged. The browser regression's
validation request is rejected before admin-client access and therefore creates no
lead or notification.

## Scope and security confirmation

- No deployment or push occurred.
- No production inquiry was submitted.
- No production data was accessed or mutated.
- No database migration, SQL, schema, billing, payment, offer-lifecycle,
  localization, release-history, recovery-document, environment, Vercel, secret,
  credential, or configuration file changed.
- No dependency was added or updated.
- No secret value appears in source, tests, command output, or this packet.
- The confirmed B-1 production notification remains PASS and the deployed baseline
  was not changed by this implementation task.
