# Post-Deployment Smoke Plan

Safe smoke checks do not create production data.

## Public and platform checks

- [ ] `/sq`, `/en`, and `/de` return HTTP 200 with correct headings.
- [ ] Services, how-it-works, about, and contact routes render in all locales.
- [ ] Contact form contains the hidden honeypot control.
- [ ] Do not submit the contact form.
- [ ] Portal link targets the production app login.
- [ ] Login page returns HTTP 200.
- [ ] Unauthorized POST to `/api/cron/generate-tasks` returns 401.
- [ ] Vercel deployment is Ready and source commit/tree is approved.
- [ ] Production domains point to that deployment.
- [ ] Runtime, function, and database logs show no new errors.
- [ ] Firewall/rate-limit rule status is recorded separately.

## Authenticated read-only checks

Using an existing approved admin account without editing data:

- [ ] Login succeeds.
- [ ] `/leads`, `/leads/follow-ups`, and `/leads/reports` render.
- [ ] Founding Customer Funnel report headings and zero-denominator states render.
- [ ] Existing lead detail renders qualification, consultation, and offer panels.
- [ ] Promotion/campaign interface renders.
- [ ] No RLS, permission, missing-column, or missing-relation error appears.

Offer PDF generation may be tested only against an already-existing legitimate
offer whose access is authorized. If none exists, defer it to the synthetic
write gate.

## Separately gated synthetic end-to-end proposal

Requires explicit Founder authorization. Use a marker such as
`STREHE-RELEASE-003-SYNTHETIC-<UTC>`, never a real person:

1. Create inquiry with non-personal example contact data.
2. Qualify, book and complete consultation.
3. Draft, render, send, and accept offer.
4. Verify founding capacity and transition concurrency.
5. Convert to synthetic client/property.
6. Create synthetic contract, invoice, and positive payment.
7. Verify payment-backed funnel and CAC.
8. Record IDs and hashes.
9. Delete in dependency order and prove zero remaining marker rows.

Do not run this proposal during release planning or without approved cleanup and
audit ownership.
