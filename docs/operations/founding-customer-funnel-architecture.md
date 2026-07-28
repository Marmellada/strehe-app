# Founding Customer Funnel Architecture

Status: implementation design for STREHE-LAUNCH-002  
Approved baseline: `47b4fa5dca0e7661009b5e7974d7608b4d3917c4`

## Decision

The existing `leads.status` pipeline (`new`, `contacted`, `interested`, `won`,
`lost`) remains intact for compatibility. Commercial progress is represented by
structured timestamps on `leads`, immutable `lead_events`, and two dedicated
internal records:

- `lead_consultations` holds the operational consultation checklist and outcome.
- `lead_offers` holds versioned service proposals. It is deliberately separate
  from `subscriptions`, which remains the service agreement/contract record.

`leads` receives first-touch attribution, qualification, and denormalized current
milestone fields needed for filtering and reporting. Original first-touch fields
are set at creation and protected from silent replacement by a database trigger.

`promotion_campaigns` remains the authoritative campaign table and is extended
with channel-neutral status, budget, actual-spend, and notes fields. Leads link to
it through `campaign_id`; a supplied campaign name can also be preserved when a
record has not yet been reconciled.

## Canonical milestones

1. Inquiry: `leads.created_at`.
2. Qualified/disqualified: `qualification_outcome`, `qualified_at`.
3. Consultation booked/completed: dedicated consultation record plus current
   scheduled/status/completed fields on the lead.
4. Offer drafted/sent/accepted/rejected/expired/superseded: versioned offer
   record plus current offer timestamps on the lead.
5. Converted: existing `converted_client_id`/`converted_at`, with the converted
   property linked from the accepted offer when available.
6. Paying customer: derived only from a positive row in `payments` joined through
   an invoice belonging to the converted client. `won` is never payment evidence.

Every operator transition writes a `lead_events` entry. Offer transitions are
validated in application code and by constrained database status values.

## Authorization and exposure

The new tables use the repository's internal authenticated RLS convention.
Application mutations additionally require `admin` or `office`. No anonymous
policy is added. Public contact submission continues through the hardened server
action/admin-client boundary and accepts only normalized, length-bounded
attribution fields. It cannot read campaigns, consultations, offers, customer
records, spending limits, or internal notes.

## Offer artifact

An authenticated route generates an Albanian proposal PDF from the saved offer
snapshot using `pdf-lib`. The PDF is a proposal, not an agreement, and acceptance
does not create or activate a subscription.

## Reporting

Funnel counts use milestone evidence, not legacy status. Paying-customer and CAC
counts use recorded payments. Breakdown dimensions are source, source detail,
campaign, package, and created-at period. Cost ratios return no value when the
denominator is zero.

## Legal and privacy review

The technical implementation includes a draft consent/privacy notice placeholder.
It is not legal approval. Paid acquisition remains blocked until the notice,
retention basis, tracking/click-ID handling, and customer-facing offer wording
receive the appropriate legal/privacy review.
