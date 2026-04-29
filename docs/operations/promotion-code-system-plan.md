# STREHE Promotion Code System Plan

## Purpose

This document defines how STREHE should support discount and promotion codes inside the app.

The first use case is simple:

- a survey respondent completes a survey
- STREHE gives them a personal 10% discount code
- the code is emailed to them
- later, if they become a client, staff enters the code on the contract
- the app calculates and records the discount

But the system should not be built only for that survey.

It should be reusable for:

- launch campaigns
- referral offers
- seasonal promotions
- manual goodwill discounts
- future lead-generation campaigns

---

## 1. Core Principle

Promotion codes should be connected to the contract, not only to the survey.

Reason:

- the contract is where the client, property, package, and monthly price come together
- billing should be able to use the final agreed price
- staff should be able to see why a client received a discount
- the discount should remain auditable later

The survey can generate the code, but the contract redeems it.

---

## 2. What The System Must Do

At minimum, the app should support:

1. Create a promotion campaign
2. Generate unique codes for that campaign
3. Assign a code to a person or email address
4. Send or record that the code was sent
5. Validate a code during contract creation
6. Apply the discount to the contract
7. Store the original price, discount, and final price
8. Prevent accidental duplicate or invalid usage
9. Keep enough history to understand what happened later

---

## 3. Recommended First Version

The first version should be practical and not too big.

### Phase 1: Internal promotion management

Build:

- campaign records
- generated codes
- manual code creation
- code validation
- code redemption on contract creation
- discount snapshots on contracts

Do not start with full automation.

### Phase 2: Email sending

Add:

- email template
- send code by email
- emailed status
- resend option

### Phase 3: Survey connection

Add:

- public survey submit flow
- automatic code generation after survey completion
- automatic email with code
- source tracking

### Phase 4: Reporting

Add:

- campaign performance
- codes issued
- codes redeemed
- conversion rate
- revenue impact

---

## 4. Data Model

## Promotion Campaigns

Table:

`promotion_campaigns`

Purpose:

- defines the offer
- controls discount amount
- controls dates and rules

Recommended fields:

- `id`
- `name`
- `description`
- `discount_type`
- `discount_percent`
- `discount_amount_cents`
- `currency`
- `starts_at`
- `ends_at`
- `active`
- `max_redemptions`
- `created_at`
- `updated_at`

Recommended `discount_type` values:

- `percent`
- `fixed_amount`

Example:

- name: Survey Launch Discount
- discount type: percent
- discount percent: 10
- active: yes
- expiry: optional

---

## Promotion Codes

Table:

`promotion_codes`

Purpose:

- stores each individual code
- supports one-person codes
- tracks issue and redemption status

Recommended fields:

- `id`
- `campaign_id`
- `code`
- `assigned_name`
- `assigned_email`
- `source`
- `status`
- `issued_at`
- `emailed_at`
- `expires_at`
- `max_redemptions`
- `redemption_count`
- `metadata`
- `created_at`
- `updated_at`

Recommended `status` values:

- `issued`
- `redeemed`
- `expired`
- `cancelled`

Recommended `source` values:

- `survey`
- `manual`
- `referral`
- `campaign`

Important rule:

- `code` must be unique

Example code format:

- `STREHE-MAY26-8K4P`
- `SURVEY-10-NQ7M`
- `WELCOME-2F9X`

Codes should be human-readable, short enough to enter manually, and hard enough to guess casually.

---

## Promotion Redemptions

Table:

`promotion_redemptions`

Purpose:

- records the moment a code is used
- preserves discount details even if the campaign changes later

Recommended fields:

- `id`
- `promotion_code_id`
- `subscription_id`
- `client_id`
- `redeemed_by_user_id`
- `redeemed_at`
- `discount_type_snapshot`
- `discount_percent_snapshot`
- `discount_amount_cents_snapshot`
- `original_monthly_price`
- `discounted_monthly_price`
- `notes`

This is important because a campaign may change later, but an old contract should keep the discount it was given at the time.

---

## Subscription / Contract Fields

Current contract creation already stores:

- client
- property
- package
- start date
- status
- monthly price

Recommended new contract fields:

- `promotion_code_id`
- `original_monthly_price`
- `discount_type`
- `discount_percent`
- `discount_amount_cents`
- `discounted_monthly_price`
- `promotion_summary_snapshot`

Recommended rule:

- `original_monthly_price` stores the normal package price
- `discounted_monthly_price` stores the final monthly contract price
- billing should use the discounted price where applicable

This is better than only overwriting `monthly_price`, because staff can always see the normal price and the discount.

---

## 5. Validation Rules

When staff enters a promotion code, the app should check:

1. Does the code exist?
2. Is the campaign active?
3. Is the code active?
4. Has the code expired?
5. Has the campaign started?
6. Has the campaign ended?
7. Has the code already reached its redemption limit?
8. Has the campaign reached its redemption limit?
9. Does the code apply to this package or contract type?
10. Is the final discounted price valid?

The final price must never go below zero.

For survey codes assigned to an email address:

- the app can show a warning if the contract client email does not match
- staff can override this later if needed
- for the first version, admin-only override is safest

---

## 6. Contract Creation Flow

The contract form should include a promotion code area.

Recommended form behavior:

1. Staff selects client, property, and package
2. App shows normal monthly price
3. Staff enters promotion code
4. Staff clicks `Apply Code`
5. App validates the code
6. App shows:
   - normal monthly price
   - discount
   - final monthly price
   - code status
7. Staff saves the contract
8. App records the redemption

Example display:

| Item | Amount |
|---|---:|
| Normal monthly price | EUR 49 |
| Survey discount | -10% |
| Final monthly price | EUR 44.10 |

The staff member should never need to calculate the discount manually.

---

## 7. Billing Behavior

Invoices should clearly reflect the discount.

There are two possible approaches.

### Option A: Store invoice line at discounted price

Example:

- Monthly package: EUR 44.10
- Note: includes 10% survey discount

This is simple.

### Option B: Store original price plus discount line

Example:

| Line | Amount |
|---|---:|
| Monthly package | EUR 49.00 |
| Survey discount | -EUR 4.90 |
| Total | EUR 44.10 |

This is clearer and better for reporting.

### Recommendation

Use Option A first if billing needs to stay simple.

Design the database so Option B can be added later without rebuilding the whole promotion system.

---

## 8. Admin UI

The app should eventually have a promotions area.

Recommended location:

- Settings
- or Finance
- or a dedicated `Promotions` module

Recommended pages:

### Campaign list

Shows:

- campaign name
- discount
- active status
- start/end dates
- issued codes
- redeemed codes

### Campaign detail

Shows:

- campaign rules
- code list
- generate code button
- redemption history

### Code detail

Shows:

- code
- assigned person/email
- status
- sent date
- redeemed date
- linked contract

---

## 9. Survey Flow

There are two possible survey approaches.

### Option A: External survey first

Use a form tool for the survey and manually import or create codes in the app.

Pros:

- fastest to launch
- less app work
- good for testing demand

Cons:

- not fully automated
- manual email/code handling

### Option B: App-powered survey

Build a public STREHE survey page.

After submission:

1. app stores survey response
2. app creates lead
3. app generates unique promotion code
4. app emails the code
5. staff can later convert the lead into a client

Pros:

- clean and scalable
- better tracking
- more professional

Cons:

- more build work
- email sending needs to be configured properly

### Recommendation

Build the promotion system inside the app first.

Then connect the survey to it.

This gives STREHE a reusable foundation instead of a one-campaign shortcut.

---

## 10. Email Requirements

The email should be short and clear.

Recommended email content:

- thank you for completing the survey
- your personal discount code
- what the discount gives
- expiry date if applicable
- how to use it
- WhatsApp/contact CTA

Example:

`Your personal STREHE code is SURVEY-10-NQ7M. If you decide to start apartment care with STREHE, this code gives you 10% off your first agreed package.`

Important:

- email should not overpromise
- discount terms should be clear
- code should be visible and easy to copy

---

## 11. Permissions

Recommended first permissions:

### Admin

Can:

- create campaigns
- generate codes
- cancel codes
- override assigned-email mismatch
- apply any valid code

### Office / Staff

Can:

- view active codes
- apply valid codes to contracts
- see discount summary

Should not initially:

- create campaigns
- change discount percentages
- override expired codes

This prevents accidental discount misuse.

---

## 12. Risks

## Risk 1: Discounts become messy

Mitigation:

- use campaigns
- snapshot discount values on redemption
- record who redeemed the code

## Risk 2: Staff applies wrong code

Mitigation:

- validate code before save
- show assigned email/name
- warn on mismatch

## Risk 3: Survey discount becomes too generous

Mitigation:

- campaign expiry
- redemption limits
- package eligibility rules

## Risk 4: Billing becomes confusing

Mitigation:

- show original price and final price on contract
- show discount note on invoice
- keep promotion redemption history

---

## 13. MVP Build Checklist

Recommended first implementation order:

1. Add database tables for campaigns, codes, and redemptions
2. Add subscription discount fields
3. Add promotion validation helper
4. Add code input to contract creation
5. Store discount snapshots on contract save
6. Record redemption after contract creation
7. Show promotion summary on contract detail
8. Make billing use the discounted monthly price
9. Add a simple admin page to create and list codes
10. Add email sending later

---

## 14. Current Decision

For STREHE, the best app-first direction is:

- build a reusable promotion code system
- start with manual code generation and contract redemption
- connect survey automation after the foundation exists
- keep email sending as phase two if needed

This gives the business flexibility without overbuilding before the first campaign.
