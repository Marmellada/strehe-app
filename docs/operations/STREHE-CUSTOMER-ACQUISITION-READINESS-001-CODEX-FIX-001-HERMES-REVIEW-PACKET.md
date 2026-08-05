# STREHE-CUSTOMER-ACQUISITION-READINESS-001-CODEX-FIX-001

Date: 2026-08-05

Prepared for: Hermes Agent

Scope: B-1 website inquiry operator notification only

Branch: `codex/fix-b1-inquiry-notification`

Base commit: `403ebd4`

## Review status

Ready for Hermes review. A valid public website inquiry now sends an operator notification only after the inquiry insert succeeds. Notification or notification-logging failure does not change the persisted inquiry or the success response returned to the customer.

## Implementation summary

- The public contact handler creates the inquiry identifier and submission timestamp before insertion, persists both, and invokes notification only after a successful insert result.
- The notification uses the existing Resend HTTP integration settings: `RESEND_API_KEY` and `PROMOTION_EMAIL_FROM`, with the existing `RESEND_FROM_EMAIL` fallback.
- The sole recipient is the existing company-profile business email used by the STREHË website. No recipient is accepted from public form input.
- The email contains the inquiry ID, customer name, available email or phone, submitted message, locale, first-touch source and available campaign attribution, and submission timestamp.
- HTML content is escaped before rendering.
- Missing or malformed notification configuration is contained as a notification failure and does not call Resend.
- Failure logging uses the structured event `public_contact_notification_failed` with only inquiry ID and a bounded failure reason. It does not log customer contact details, the message, provider response bodies, or configuration values.
- Existing 15-minute equivalent-inquiry suppression prevents a normal request retry from creating or notifying twice. The Resend request also uses `public-inquiry/<inquiry-id>` as its idempotency key for repeated delivery attempts concerning the same persisted inquiry.

## Failure handling

Persistence remains the customer-success boundary. Insert errors retain the existing localized failure and mail fallback. After persistence, notification configuration errors, provider rejections, network exceptions, unexpected notification exceptions, and logger exceptions are isolated. None delete, invalidate, or update the inquiry, and none return a false submission failure to the customer.

There is no retry queue or database notification state because the authorized scope forbids database migrations and broader email-architecture work. Resend idempotency plus the existing inquiry duplicate check provides duplicate protection within the current architecture.

## Security review notes

- No new secret or environment variable was introduced or requested.
- No secret value is present in source, tests, logs, or this packet.
- Notification settings remain server-only and are not returned by the Server Action.
- The operator recipient comes from the trusted server-side company profile, not the untrusted hidden `company_email` form field.
- Validation, NFKC normalization, honeypot containment, attribution normalization, rate limiting outside this handler, generic customer errors, the constrained admin-client interface, duplicate suppression, and lead revalidation remain in place.
- No provider error body is included in structured logging.

## Changed files

- `lib/actions/public-contact.ts` — wires the company-profile recipient, existing Resend sender, inquiry ID generation, and structured failure logging.
- `lib/security/public-contact.ts` — invokes notification after persistence and isolates all notification-side failures.
- `lib/email/inquiry-notification-email.ts` — builds and sends the escaped operator email, validates settings, and supplies the Resend idempotency key.
- `tests/unit/public-contact.spec.ts` — covers persistence/notification success, notification failure, invalid input, duplicate suppression, persistence failure, and exception containment.
- `tests/unit/inquiry-notification-email.spec.ts` — covers recipient containment, email content, HTML escaping, idempotency, missing settings, malformed settings, and provider rejection.
- `playwright.entry-security.config.ts` — includes the focused email test file in the security unit-test configuration.
- `docs/operations/STREHE-CUSTOMER-ACQUISITION-READINESS-001-CODEX-FIX-001-HERMES-REVIEW-PACKET.md` — this packet.

## Automated verification

- `npx tsc --noEmit` — passed.
- `npx eslint lib/actions/public-contact.ts lib/security/public-contact.ts lib/email/inquiry-notification-email.ts tests/unit/public-contact.spec.ts tests/unit/inquiry-notification-email.spec.ts` — passed.
- `npx playwright test --config playwright.entry-security.config.ts tests/unit/public-contact.spec.ts tests/unit/inquiry-notification-email.spec.ts` — passed (21 tests).
- `npm run build` — application compilation and TypeScript passed; page-data collection then stopped on the pre-existing local environment error `supabaseUrl is required` for `/keys/[id]`. No credential was added or requested to bypass this environment-only limitation.

## Scope confirmation

The Hermes audit report was not modified. B-2, B-3, billing security, localization, phone links, general email architecture, database schema, and production configuration were not changed.

No deployment occurred. No database migration occurred. No production data or configuration was read, written, or mutated.

## Hermes review focus

1. Confirm the company-profile business email is the intended sole operator recipient.
2. Confirm post-insert ordering and customer-success isolation meet B-1.
3. Confirm the notification fields are operationally sufficient without unnecessary personal data.
4. Confirm duplicate suppression and the Resend idempotency key are proportionate to the no-migration constraint.
5. Confirm the structured failure event is adequate for current application logging.
