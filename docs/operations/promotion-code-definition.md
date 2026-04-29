# STREHE Promotion Code Definition

## Status

Working definition before implementation.

This document defines what promotion codes mean in the STREHE app before we build them.

The goal is to avoid building a one-time survey feature that becomes hard to reuse later.

---

## 1. Simple Definition

A promotion code is a controlled discount that can be issued to a person and applied to a STREHE contract.

For the first version:

- the code is created inside the app
- the code belongs to a promotion campaign
- the code may be assigned to a person or email
- staff can apply the code when creating a contract
- the app calculates the discount
- the contract stores the normal price, discount, and final price

---

## 2. First Use Case

The first use case is the survey discount.

Flow:

1. A person completes the STREHE survey
2. STREHE gives them a personal 10% discount code
3. The code is emailed or manually sent to them
4. Later, if they become a client, staff enters the code during contract setup
5. The app validates the code
6. The app applies the discount to the contract
7. The code is marked as redeemed

Example:

- normal package price: EUR 49 per month
- promotion code: `SURVEY-10-X7K2`
- discount: 10%
- final contract price: EUR 44.10 per month

---

## 3. What A Code Is Not

A promotion code is not:

- a free-text note
- a manual price override
- a one-time invoice adjustment only
- a survey-only field
- a hidden discount with no audit trail

If a discount affects the contract price, it should be visible and traceable.

---

## 4. Core Objects

## Campaign

A campaign defines the offer.

Examples:

- Survey Launch Discount
- Family Referral Discount
- May 2026 Launch Offer

The campaign controls:

- discount amount
- start date
- end date
- whether the campaign is active
- how many codes can be redeemed

## Code

A code is the individual value given to a person.

Examples:

- `SURVEY-10-X7K2`
- `WELCOME-10-MAY26`
- `REF-ARBEN-9P3Q`

The code controls:

- who it was assigned to
- whether it was sent
- whether it was redeemed
- whether it has expired or been cancelled

## Redemption

A redemption is the moment the code is used on a contract.

The redemption records:

- which code was used
- which client used it
- which contract received it
- who applied it
- what discount was applied
- what the price became

---

## 5. First Version Scope

The first app version should support:

- create one campaign
- generate or create unique codes
- assign code to name and email
- view code status
- apply code during contract creation
- calculate discounted monthly price
- mark code as redeemed
- show promotion summary on the contract

The first version does not need:

- public survey automation
- automatic email sending
- complex analytics
- public self-service redemption
- multiple discounts on one contract
- discount stacking

This keeps the first build useful but controlled.

---

## 6. Recommended First Campaign

Campaign name:

`Survey Launch Discount`

Discount:

`10%`

Code type:

`unique per respondent`

Usage:

`one contract only`

Expiry:

Recommended:

- valid until 31 December 2026

Reason:

- enough time for someone abroad to think and decide
- not open forever
- clean first-year campaign boundary

Public wording:

`Complete the survey and receive a personal 10% launch discount code if you decide to start with STREHE.`

Internal wording:

`10% off the agreed monthly package price for the first contract period, subject to STREHE approval.`

---

## 7. Discount Rules

For the first version:

- one code can be used once
- one contract can have one promotion code
- the discount applies to the monthly package price
- the discount does not apply automatically to reimbursed expenses
- the discount does not apply to third-party technician costs
- the discount does not apply to one-off pass-through costs

Recommended rule:

Discount only the STREHE service fee.

Do not discount money that STREHE pays to third parties on behalf of the client.

---

## 8. Price Calculation

The app should calculate:

1. normal package price
2. discount amount
3. final monthly price

Example:

| Item | Amount |
|---|---:|
| Normal monthly price | EUR 49.00 |
| Discount | -10% |
| Discount value | EUR 4.90 |
| Final monthly price | EUR 44.10 |

The final price should be rounded to two decimals.

The final price must never be negative.

---

## 9. Contract Display

The contract should show:

- package
- normal monthly price
- promotion code
- discount
- final monthly price

Example:

`Survey Launch Discount applied with code SURVEY-10-X7K2. Normal price EUR 49.00, final price EUR 44.10.`

This should be visible to staff so there is no confusion later.

---

## 10. Billing Definition

For the first version, billing should use the final discounted monthly price from the contract.

The invoice should include a note such as:

`Includes Survey Launch Discount: 10%`

Later, invoices can show a separate discount line.

For the first version, simplicity is acceptable as long as the contract stores the discount clearly.

---

## 11. Code Statuses

Recommended code statuses:

- `issued`
- `sent`
- `redeemed`
- `expired`
- `cancelled`

Meaning:

| Status | Meaning |
|---|---|
| issued | code exists but may not have been sent yet |
| sent | code was sent or manually given to the person |
| redeemed | code was used on a contract |
| expired | code can no longer be used |
| cancelled | code was manually disabled |

---

## 12. Staff Rules

Staff should be able to:

- search for a code
- see who it belongs to
- see whether it is valid
- apply it to a contract

Staff should not manually calculate the discount.

Admin should be able to:

- create campaigns
- create codes
- cancel codes
- override email mismatch if needed

---

## 13. Issued-To Rule

For survey codes, the code may be assigned to a specific email.

This is mainly for tracking and sending the code.

It should not block redemption.

Example:

- the code is sent to Hasan
- Hysen later signs the contract and uses that code
- the app allows it
- the app records that the code was issued to Hasan
- the app records that Hysen's contract redeemed it

Reason:

- diaspora families often use different emails or family members
- the app should record the truth without becoming too rigid
- the business can later see which issued code led to which signed contract

---

## 14. Manual Before Automatic

The first version can be manual.

That means:

- staff creates the survey campaign
- staff creates codes
- staff sends the code manually or marks it as sent
- staff applies the code during contract setup

This is enough to test the business.

Automation can come after the workflow proves useful.

---

## 15. Definition Of Done For V1

The promotion code feature is considered ready for first use when:

1. Admin can create a 10% survey campaign
2. Admin can create a unique code for a person
3. Admin can assign name and email to the code
4. Staff can enter the code during contract creation
5. App validates whether the code can be used
6. App calculates the discounted monthly price
7. Contract stores original price, discount, and final price
8. Code becomes redeemed after contract creation
9. Contract detail shows the promotion summary
10. Billing uses the final discounted contract price

---

## 16. Current Decision

For STREHE, the first promotion system should be:

- contract-based
- campaign-based
- one code per respondent
- one redemption per code
- discount applied only to STREHE monthly service fee
- manual-first, automation-later

This gives STREHE enough structure for the survey discount while keeping the system reusable for future promotions.
