# STREHE Launch Finish Checklist

## Purpose

This is the living checklist for finishing the STREHE app, website, and launch operations without drifting into too many side ideas.

Rule:

- update this file whenever a meaningful item is completed
- avoid adding new scope unless it is necessary for launch, security, trust, or clear business value
- keep experimental ideas parked instead of mixing them into launch work

---

## Current Principle

The first launch should prove that STREHE can reliably handle:

1. clients
2. properties
3. contracts
4. tasks / visits
5. keys
6. invoices / payments
7. basic promotion codes
8. clear public marketing and lead capture through CRM leads

Everything else should support that core.

---

## Current Validation Snapshot

Last updated: 2026-04-29

- [x] Playwright auth bootstrap now creates/repairs a dedicated admin E2E user automatically
- [x] Settings smoke suite passes end to end
- [x] General settings page loads
- [x] Expense category create / disable / enable flow works
- [x] Vendor create / disable / enable flow works
- [x] Users page loads
- [x] Company cash-account creation smoke flow works
- [x] Client creation smoke flow works
- [x] Property creation smoke flow works
- [x] Property key creation smoke flow works
- [x] Promotion campaigns and codes smoke flow works
- [x] Subscription creation with promotion and contract PDF smoke flow works
- [x] Task create / report / cancel smoke flow works
- [x] Invoice creation with service promotion, issue flow, and invoice PDF smoke flow works
- [x] Invoice payment recording smoke flow works
- [x] Credit note creation, issue flow, PDF, and original-invoice settlement smoke flow works
- [x] Subscription-generated task smoke flow works
- [x] Subscription cancellation smoke flow works
- [x] Dedicated edit-flow smoke covers category, vendor, client, property, contract, task, and invoice editing without touching UI appearance/settings pages
- [x] Dedicated key custody smoke covers key status changes and key log history
- [x] Dedicated task assignment smoke covers assigned task creation, unassign, assign-to-me, in-progress status, and report submission
- [x] Dedicated operations smoke covers package/service create-edit, worker creation, expense entry, and task report attachments
- [x] Dedicated finance smoke covers paid invoice collection and settled invoice finance summary
- [x] Dedicated contract integrity smoke covers draft-to-active lifecycle, saved display snapshots, and one-active-contract guard
- [x] Dedicated property integrity smoke covers owner link, location fields, and active-to-vacant status lifecycle
- [x] Dedicated banking settings smoke covers licensed-bank registry, invoice-visible bank account, and hidden cash account setup
- [x] Dedicated leads smoke covers lead create, edit, interaction note, and conversion to client

### Current Known E2E Findings

- Post-RLS key creation required authenticated server clients on the property key create/list pages; this is now patched in code.
- Main smoke suite now passes end to end, including cash-account setup and credit-note settlement.
- Dedicated generator smoke passes: contract -> cron route -> generated task appears -> rerun avoids duplicates.
- Dedicated editing smoke is scoped to records it creates itself so it avoids mutating shared appearance/system settings.

### Launch Checklist Smoke Command

Run the full launch-checklist smoke coverage with:

```bash
npm run test:launch-checklist
```

This runs the main smoke suite, settings smoke suite, subscription generator smoke, editing-flow smoke, key custody smoke, task assignment smoke, operations smoke, finance smoke, contract integrity smoke, property integrity smoke, and banking settings smoke with the shared Playwright auth setup.

Run focused key custody coverage with:

```bash
npm run test:smoke:keys
```

Run focused task assignment coverage with:

```bash
npm run test:smoke:tasks
```

Run focused package/service/worker/expense/attachment coverage with:

```bash
npm run test:smoke:operations
```

Run focused finance overview coverage with:

```bash
npm run test:smoke:finance
```

Run focused contract integrity coverage with:

```bash
npm run test:smoke:contracts
```

Run focused property integrity coverage with:

```bash
npm run test:smoke:properties
```

Run focused banking settings coverage with:

```bash
npm run test:smoke:banking
```

Run focused CRM leads coverage with:

```bash
npm run test:smoke:leads
```

---

## 1. Source Control And Release Hygiene

- [x] Commit current stable work
- [x] Push current stable work
- [x] Exclude temporary local review files from commit
- [x] Confirm `.env.local` is not committed
- [ ] Keep a note of manually applied Supabase migrations
- [ ] Rotate exposed/testing secrets before real launch

### Notes

Temporary files currently known:

- `tmp-marketing-dev*.log`
- `tmp-marketing-review/`

---

## 2. Supabase And Security

- [x] Reduce Supabase Security Advisor errors to zero
- [x] Enable RLS on exposed public app tables
- [x] Remove old legacy `public.users` / roles model
- [x] Move active logo usage to `company-logos`
- [x] Make legacy `branding` bucket non-public
- [x] Set function search paths for known warning functions
- [ ] Configure Supabase Auth email provider
- [ ] Enable leaked password protection
- [ ] Review remaining Supabase warnings
- [ ] Replace broad authenticated RLS policies with role-specific policies later

### Role-Specific RLS Later

Current policy posture:

- anonymous access is blocked from sensitive app tables
- authenticated access is intentionally broad so the app keeps working

Future policy posture:

- admin can manage everything
- office can manage operations and billing
- field can access assigned task/key/report work
- contractor can access only assigned work

---

## 3. Authentication And Users

- [x] Canonical user management lives in `/settings/users`
- [x] Legacy `/users` routes redirect to `/settings/users`
- [x] Old legacy user action code removed
- [ ] Configure real email sending for user invites/setup
- [ ] Test staff invite flow end to end with real provider
- [ ] Test password reset flow end to end
- [x] Finalize role names and access expectations
- [x] Add/confirm onboarding instructions for first staff users

---

## 4. Clients And Properties

- [x] Test client creation
- [x] Test client editing
- [x] Test property creation
- [x] Test property editing
- [x] Confirm property status lifecycle
- [x] Confirm owner/client relationship is clear
- [x] Confirm property location fields are enough for launch
- [ ] Confirm public website and app language align around apartments first

---

## 4A. CRM-Lite / Leads

- [x] Decide to use CRM-lite as the pre-launch lead capture add-on
- [x] Add leads database migration
- [x] Add lead create / list / detail / edit screens
- [x] Add lead interaction notes
- [x] Add next follow-up date and assignment fields
- [x] Add convert lead to client action
- [x] Add lead qualification fields: interest, preferred contact, property count, estimated value
- [x] Add CRM list search, status filter, source filter, and pipeline stage cards
- [x] Update lead follow-up date from interaction logging
- [x] Connect public contact form to create website leads
- [x] Add tracked WhatsApp CTA messages with page/language source markers
- [x] Add quick WhatsApp lead creation path for staff
- [x] Add CRM follow-up and lead summary widgets to dashboard
- [x] Add lead timeline / event history
- [x] Add Kanban-style pipeline board
- [x] Add duplicate lead/client warnings on lead detail
- [x] Add enhanced lead conversion with client type and optional draft property
- [x] Add dedicated lead follow-ups page
- [x] Add lead source/status reporting page
- [x] Apply CRM leads migration in Supabase
- [x] Run dedicated leads smoke test

---

## 5. Keys And Access

Launch SOP: `docs/operations/launch-operations-sop.md`

- [x] Decide physical key cabinet / storage method
- [x] Define key labeling format
- [x] Define key handover process
- [x] Define key return process
- [x] Test key creation for a property
- [x] Test key status changes
- [x] Test key log history
- [ ] Decide what key/access proof appears in public marketing

### Later

- [ ] Cabinet slot model
- [ ] Key audit report
- [ ] Printed key labels

---

## 6. Contracts / Subscriptions

- [x] Test contract creation
- [x] Test contract editing
- [x] Test contract cancellation
- [x] Confirm lifecycle states: draft / prepared / active / paused / cancelled
- [x] Confirm one active contract per property rules
- [x] Confirm package snapshot is saved correctly
- [ ] Confirm promotion discount snapshot is saved correctly
- [x] Test contract PDF generation
- [ ] Polish contract PDF if needed

---

## 7. Packages And Services

Launch business baseline: `docs/operations/launch-business-baseline.md`

- [x] Finalize launch package structure
- [x] Finalize launch package prices
- [x] Finalize included visit counts
- [x] Finalize add-on services
- [x] Test package creation
- [x] Test package editing
- [x] Test service creation
- [x] Test service editing
- [x] Confirm package services are read correctly by task generation

### Current Pricing Direction To Validate

- Basic: 1 visit/month
- Care: 2 visits/month
- Care Plus: stronger trust/support layer
- Arrival-ready support as add-on
- Technician coordination as add-on or paid service

---

## 8. Tasks And Visit Engine

- [x] Test manual task creation
- [x] Test task assignment
- [x] Test task status flow
- [x] Test task report submission
- [x] Test task attachments
- [x] Test subscription-generated task creation
- [x] Test duplicate prevention
- [x] Test monthly service generation
- [ ] Test weekly service generation if used
- [ ] Configure Vercel cron for task generation
- [ ] Confirm cron secret is set in Vercel
- [x] Confirm generated task snapshots are correct

### Important

The task engine is launch-critical because recurring apartment care depends on it.

---

## 9. Billing, Invoices, Payments, And PDFs

- [x] Test invoice creation
- [x] Test invoice editing
- [x] Test invoice detail page
- [x] Test payment recording
- [x] Test invoice status changes
- [x] Test credit note creation
- [x] Test credit note settlement behavior
- [x] Test invoice PDF generation
- [x] Test contract PDF generation
- [ ] Polish invoice PDF discount display
- [ ] Confirm company logo appears in PDFs
- [ ] Confirm company bank details appear correctly
- [ ] Confirm VAT behavior is correct for launch

---

## 10. Promotion Codes

- [x] Promotion campaigns database created
- [x] Promotion codes database created
- [x] Promotion redemptions database created
- [x] Promotion settings page added
- [x] Manual code generation added
- [x] Contract redemption added
- [x] Service-line invoice redemption added
- [x] Promotion target added: package / service / both
- [x] Apply migration for `promotion_campaigns.applies_to`
- [ ] Configure real email provider/API key
- [ ] Test automatic email sending
- [ ] Test bulk code generation and sending
- [ ] Add/report campaign performance

### Later Reporting

- issued codes
- sent codes
- redeemed codes
- redeemed by campaign
- revenue impacted by discounts

---

## 11. Email

- [ ] Decide final provider for app transactional email
- [ ] Configure email provider in Supabase Auth
- [ ] Configure promotion-code sending provider
- [ ] Decide sender identity
- [ ] Verify domain before public launch
- [ ] Test user setup email
- [ ] Test password reset email
- [ ] Test promotion code email

### Temporary

Personal email/testing sender is acceptable only before real launch.

---

## 12. Public Website

- [x] Public marketing website built
- [x] Multilingual structure started
- [x] STREHE logo reused from app/company settings
- [x] Diaspora-family trust visual direction documented
- [ ] Final website copy review
- [ ] Final mobile QA
- [ ] Final desktop QA
- [ ] Test language switcher
- [ ] Test WhatsApp CTA
- [ ] Test contact form
- [ ] Test login path
- [ ] Add/confirm SEO metadata
- [ ] Replace or polish temporary/generated visuals
- [ ] Confirm no people-focused photos if that remains the chosen direction

---

## 13. Marketing And Social Launch

- [ ] Create new STREHE Instagram account
- [ ] Create/confirm STREHE Facebook page
- [ ] Add logo, bio, contact link
- [ ] Prepare first 9 trust-building posts
- [ ] Prepare old-page soft announcement if useful
- [ ] Prepare WhatsApp-first lead flow
- [ ] Decide whether to run paid ads in launch month

### First Post Themes

- Who checks your apartment while you live abroad?
- Why relatives are not a system
- What we check during a visit
- Apartment care in Prishtina and Fushe Kosove

---

## 14. Business And Operations

Launch SOP: `docs/operations/launch-operations-sop.md`
Launch business baseline: `docs/operations/launch-business-baseline.md`

- [x] Finalize first-year pricing model
- [x] Finalize launch packages
- [x] Finalize staff trigger points
- [x] Finalize solo operating limit
- [x] Finalize operating cost assumptions
- [x] Prepare visit checklist
- [x] Prepare photo report template
- [x] Prepare client onboarding checklist
- [x] Prepare urgent issue procedure
- [x] Prepare technician coordination procedure
- [x] Prepare key handling SOP

---

## 15. Workers, Vendors, And Expenses

- [x] Test worker creation
- [x] Test vendor creation
- [x] Test expense category creation
- [x] Test expense entry
- [x] Confirm finance overview includes expected numbers
- [x] Decide whether workers are needed at launch or later
- [x] Decide first hire type and monthly wage range

---

## 16. Banking And Finance Settings

- [x] Confirm company bank account details
- [x] Confirm invoice bank display
- [x] Confirm payment methods
- [x] Confirm Kosovo bank registry entries
- [x] Confirm bank detection rules are not launch-blocking

### Current blocker

- [x] Fix `/settings/banking/new` so choosing `Cash Account` hides or removes bank-only required fields and allows submission

---

## 17. Inspection Lab / Engine

- [x] Inspection lab is intentionally quarantined from v1
- [x] Placeholder routes explain it is paused
- [x] Do not include inspection engine in launch scope
- [x] Revisit for v2 only after core operations work reliably

### Reason

The inspection engine is interesting, but launch trust depends more on reliable human process, reporting, keys, billing, and communication.

---

## 18. Deployment And Vercel

- [ ] Set all required env vars in Vercel
- [ ] Confirm Supabase URL/key values in Vercel
- [ ] Confirm service role key is server-only
- [ ] Configure cron route for task generation
- [ ] Check Vercel build
- [ ] Check Vercel runtime logs
- [ ] Check Vercel firewall/traffic after launch
- [ ] Confirm production domain
- [ ] Confirm public website routes work in production

---

## 19. Launch Readiness Test

Run this full flow before launch:

- [ ] Create user
- [ ] Create client
- [ ] Create property
- [ ] Add key
- [ ] Create package
- [ ] Create service
- [ ] Create contract
- [ ] Generate task from contract
- [ ] Complete task report
- [ ] Create invoice
- [ ] Apply promotion code if relevant
- [ ] Generate invoice PDF
- [ ] Record payment
- [ ] Confirm finance overview
- [ ] Create and convert a lead
- [ ] Submit public website contact form
- [ ] Click WhatsApp CTA

---

## Parking Lot

Ideas that are useful but not launch blockers:

- advanced inspection engine
- advanced campaign analytics
- client portal
- owner-facing reports dashboard
- stricter per-role RLS
- key cabinet slot UI
- automated social post generation
- public pricing page
- testimonials/proof library
- house-service expansion
