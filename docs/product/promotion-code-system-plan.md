# STREHË Promotion Code System Plan

## Purpose

This document defines a reusable promotion-code system for STREHË.

The first use case is:

- survey respondent receives a personal `10%` discount code by email
- later, if they become a client, staff enters the code on the contract
- the app calculates the discount correctly

But the system should not be built only for surveys.

It should be reusable for:

- launch campaigns
- referral campaigns
- seasonal promotions
- partner campaigns
- one-off manual discounts

---

## 1. Product principle

Promotion codes should be:

- trackable
- limited
- auditable
- reusable across campaigns
- safe from accidental overuse

They should not be:

- random text notes
- manually calculated every time
- hidden inside contract notes
- tied only to one survey flow

---

## 2. First version behavior

## Survey flow

1. person completes survey
2. if they leave email, app creates a unique promo code
3. app emails the code
4. code is stored in the database
5. when the person signs later, staff enters the code during contract setup
6. app validates the code
7. discount is stored on the contract
8. invoices can reflect the discount

## Manual flow

Staff/admin can also:

- create a campaign
- generate one code
- generate many codes
- assign a code to a lead/client/email
- deactivate a code
- inspect redemptions

---

## 3. Discount types

The system should support at least:

| Type | Example | Use case |
| --- | --- | --- |
| Percentage | `10% off` | Survey, launch, referral |
| Fixed amount | `€20 off` | One-off goodwill |

Later, it may support:

- first month only
- first 3 months
- recurring lifetime discount
- onboarding fee discount

But v1 should stay simple.

---

## 4. Recommended v1 discount rules

For the first survey promotion:

| Rule | Recommendation |
| --- | --- |
| Discount | `10%` |
| Applies to | monthly contract price |
| Duration | first 3 months or first month only |
| Code type | unique per respondent |
| Redemption limit | once |
| Expiration | 60-90 days after issue |
| Stackable with other discounts | no |

### Important decision

Do not default to lifetime `10%` off.

A lifetime discount can become expensive later.

Better launch options:

1. `10% off first month`
2. `10% off first 3 months`
3. `10% off setup/onboarding`

Recommended:

- `10% off first 3 months`

This feels meaningful but does not damage long-term revenue forever.

---

## 5. Data model

## Table: promotion_campaigns

Represents a campaign, not an individual code.

Example campaigns:

- Survey Launch 2026
- First 20 Clients
- Referral Q3 2026

Suggested fields:

| Column | Type | Purpose |
| --- | --- | --- |
| id | uuid | primary key |
| name | text | internal campaign name |
| public_name | text | optional customer-facing name |
| description | text | internal notes |
| discount_type | text | percent / fixed_amount |
| discount_percent | numeric | e.g. 10 |
| discount_amount_cents | integer | fixed amount if used |
| applies_to | text | subscription_monthly_price / invoice_total / onboarding_fee |
| duration_months | integer | null or number of months |
| starts_at | timestamptz | optional |
| expires_at | timestamptz | optional |
| max_redemptions | integer | campaign-wide cap |
| is_active | boolean | campaign status |
| created_at | timestamptz | audit |
| updated_at | timestamptz | audit |

## Table: promotion_codes

Represents individual codes.

Suggested fields:

| Column | Type | Purpose |
| --- | --- | --- |
| id | uuid | primary key |
| campaign_id | uuid | link to campaign |
| code | text | unique human-entered code |
| assigned_email | text | optional recipient email |
| assigned_name | text | optional name |
| source | text | survey / manual / referral / partner |
| max_redemptions | integer | usually 1 |
| redeemed_count | integer | count used |
| expires_at | timestamptz | code-specific expiry |
| is_active | boolean | can disable code |
| sent_at | timestamptz | email sent |
| created_at | timestamptz | audit |
| updated_at | timestamptz | audit |

## Table: promotion_redemptions

Represents actual usage.

Suggested fields:

| Column | Type | Purpose |
| --- | --- | --- |
| id | uuid | primary key |
| promotion_code_id | uuid | code used |
| campaign_id | uuid | denormalized for easier reporting |
| client_id | uuid | client who used it |
| subscription_id | uuid | contract where applied |
| invoice_id | uuid | optional invoice where first applied |
| redeemed_by_user_id | uuid | staff/admin who applied it |
| discount_type | text | snapshot |
| discount_percent | numeric | snapshot |
| discount_amount_cents | integer | snapshot |
| duration_months | integer | snapshot |
| redeemed_at | timestamptz | audit |
| notes | text | optional |

---

## 6. Subscription fields

Contracts/subscriptions should store the discount snapshot.

Suggested new fields on `subscriptions`:

| Column | Type | Purpose |
| --- | --- | --- |
| promotion_code_id | uuid | applied code |
| promotion_code_snapshot | text | code text at time of application |
| discount_type | text | percent / fixed_amount |
| discount_percent | numeric | e.g. 10 |
| discount_amount_cents | integer | fixed discount if used |
| discount_duration_months | integer | e.g. 3 |
| discount_starts_on | date | when discount begins |
| discount_ends_on | date | optional calculated end |
| monthly_price_before_discount | numeric | original price |
| monthly_price_after_discount | numeric | discounted price |

### Why store snapshots?

Because campaigns can change later.

The contract should preserve what was agreed when the client signed.

---

## 7. Billing behavior

Invoices should not guess the discount from live campaign settings.

Billing should read the contract snapshot and apply discount only if:

- discount exists
- invoice period is within discount duration
- invoice is for the relevant subscription

## Invoice item recommendation

When discount applies, create a visible invoice line:

| Description | Quantity | Unit price |
| --- | ---: | ---: |
| Care Plus monthly service | 1 | `€109.00` |
| Survey launch discount | 1 | `-€10.90` |

This is clearer than silently changing the price.

### Why visible discount line?

- client understands the discount
- invoice remains auditable
- staff can see why total changed
- discount does not corrupt package pricing

---

## 8. App screens needed

## Admin: Promotions list

Path suggestion:

- `/settings/promotions`

Shows:

- campaigns
- active status
- expiration
- codes issued
- redemptions

## Admin: Campaign detail

Path suggestion:

- `/settings/promotions/[id]`

Actions:

- create/edit campaign
- generate code
- generate batch
- deactivate campaign
- view codes
- view redemptions

## Contract create/edit

Add:

- promo code field
- validate/apply button
- discount preview
- final monthly price after discount

## Contract detail

Show:

- applied promo code
- discount
- duration
- original monthly price
- discounted monthly price

## Billing/invoice

Show:

- discount line item
- discount reference

---

## 9. Survey integration options

## Option A: external survey first

Use Google Forms / Typeform.

Then:

- export respondent emails
- import/generate codes manually in app
- send emails manually or through a batch action later

Pros:

- fastest
- no public survey backend required yet

Cons:

- not fully automated

## Option B: app-hosted survey

Build survey inside STREHË website/app.

Then:

- form submission creates lead
- code is generated automatically
- email is sent automatically

Pros:

- cleanest flow
- best tracking

Cons:

- more work
- needs email provider integration
- needs anti-spam/privacy handling

## Recommended v1

Start with:

- Option A plus internal promotion-code system

Meaning:

- collect survey externally
- generate codes in app
- send codes by email from the app or manually at first

Then later:

- build app-hosted survey if it proves useful

---

## 10. Email sending

Eventually, promo code emails should be sent by the app.

Options:

- Resend
- Supabase Edge Function
- SMTP provider
- manual email in v1

Recommended:

- Resend later if deploying on Vercel

V1 can start with:

- generate code
- copy email text
- send manually

Then automate once the promo model is proven.

---

## 11. Code generation rules

Promo codes should be:

- readable
- unique
- not too long
- not guessable enough to abuse easily

Example:

- `STREHE-SURVEY-8K4P`
- `STREHE10-MIRA-2F7Q`
- `SURVEY10-X9KD`

Recommended v1 format:

- `SURVEY10-XXXX`

where `XXXX` is random uppercase letters/numbers.

---

## 12. Validation rules

When staff enters a promo code, app should check:

- code exists
- code is active
- campaign is active
- code is not expired
- campaign is not expired
- redemption limit not reached
- code is not already used by another contract
- if assigned_email exists, warn if client email does not match

### Important

The system should allow admin override only deliberately.

Do not silently apply invalid codes.

---

## 13. Reporting needed later

Useful promotion reporting:

- codes issued
- codes sent
- codes redeemed
- campaign conversion rate
- revenue affected by discounts
- clients acquired by campaign

For survey campaign:

- respondents
- codes issued
- contracts signed
- discount cost

---

## 14. Implementation phases

## Phase 1: Core database and manual app flow

Build:

- promotion_campaigns
- promotion_codes
- promotion_redemptions
- subscription discount fields
- contract create/edit promo code field
- validation/apply logic

No automatic email yet.

## Phase 2: Admin UI

Build:

- promotions list
- create campaign
- generate code
- view redemptions

## Phase 3: Email sending

Build:

- send promo code email
- store sent_at
- reusable email template

## Phase 4: Survey integration

Build:

- survey response import or app-hosted survey
- automatic code generation after survey completion

---

## 15. Recommended first build

The first build should be:

1. database migration
2. reusable promo validation function
3. promo code field on contract create/edit
4. discount snapshot on subscription
5. visible discount on contract detail

Then add:

- promotions admin pages
- email sending
- survey automation

This keeps the system useful quickly without overbuilding.

---

## 16. Open decisions

Before coding, decide:

1. survey discount duration
   - first month
   - first 3 months
   - setup fee only

2. whether public pricing is shown immediately

3. whether promo codes can be reused

4. whether codes are assigned to email

5. whether discounts apply before or after VAT

6. whether discount appears as invoice line item

### Current recommendation

| Decision | Recommendation |
| --- | --- |
| Survey discount | `10% off first 3 months` |
| Code uniqueness | unique per respondent |
| Redemption limit | once |
| Email assignment | yes, store assigned email |
| VAT treatment | discount before VAT |
| Invoice display | visible discount line |
| Reusable system | yes |

---

## 17. Working summary

The promotion system should be built as a reusable campaign/code/redemption model.

The survey discount is only the first campaign.

The right architecture is:

- campaign defines the offer
- code represents the individual claim
- redemption records usage
- subscription stores the agreed discount snapshot
- invoice shows the discount visibly

This keeps the system:

- flexible
- auditable
- reusable
- safer for future campaigns
