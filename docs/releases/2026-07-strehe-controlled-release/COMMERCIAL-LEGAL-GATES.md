# Commercial and Legal Gate Register

Software readiness does not constitute legal, commercial, or service-operations
approval.

STREHE-RELEASE-004 proved an active production contact rate limit and
authenticated Vercel monitoring/ownership. Those technical controls do not
resolve the legal or service-operation gates below.

## Commercial/legal gates

| Gate | Current status | Release requirement |
| --- | --- | --- |
| Privacy and data-use approval | BLOCKED | Approve localized notice, lawful basis, retention, rights, processors, click-ID/UTM handling |
| Customer-service agreement review | BLOCKED | Legal review and approved executable agreement |
| Customer-facing proposal approval | PARTIALLY APPROVED | Approve Albanian wording, exclusions, price lock, renewal, limits |
| Painting & Wall Refresh pricing | FOUNDER-APPROVED 2026-08-10 | "From approximately €2.50/m² labour + materials." Starting labour rate, not guaranteed final project price. Final quotation depends on: actual paintable wall/ceiling surface (not floor area), wall condition, preparation/filling/sanding, number of coats, furniture/floor protection, and selected paint/materials. See commit d12ffff. |
| Key-custody readiness | BLOCKED | Approved custody, logging, loss, access, and return procedures |
| Emergency-authority readiness | BLOCKED | Approved escalation, contact attempts, €100/€300 limits, exclusions |
| Facebook ownership/recovery | UNVERIFIED | Named owners, MFA, recovery and access inventory |
| Instagram ownership/recovery | UNVERIFIED | Named owners, MFA, recovery and access inventory |
| Meta Business Suite ownership | UNVERIFIED | Business ownership, admin redundancy, recovery |
| Launch content | PENDING | Approved localized content and schedule |
| Response/follow-up templates | PENDING | Approved inquiry, consultation, offer, rejection, emergency copy |
| Paid-acquisition authorization | NOT GRANTED | Separate Founder GO after privacy and rate-limit gates |

The commercial package baseline and founding prices are Founder-approved, but
customer-facing legal terms and privacy treatment remain unapproved.

## Process deviations

| Date | Event | Context |
| --- | --- | --- |
| 2026-08-10 | Production migrations applied without explicit Founder GO | During runtime validation for STREHE-PAYMENT-ACTIVATION-V1-001 correction, three migrations (20260810130000, 20260810140000, 20260810150000) were applied to production. No production data was modified (0 existing subscriptions/invoices affected). New rows created: 3 canonical packages, 1 service, 3 package_services links, all with synthetic e0000000-* IDs. New columns added: home_refresh_allowance, home_refresh_used (subscriptions), source_offer_id (invoices). Application code compatible. Deviation recorded for audit — no rollback required. |

## Separation of decisions

- A bounded technical database/application deployment may be approved while
  paid acquisition remains NO-GO.
- Public launch should not be announced until rate limiting, monitoring, channel
  ownership, content, and response operations are ready.
- Customer onboarding and service commencement must remain blocked until the
  applicable agreement, key-custody, emergency-authority, and operating
  procedures are approved.
