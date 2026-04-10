# STREHË Banking Module Plan

This document locks the intended banking model before connecting it to clients, vendors, or broader automation.

## Purpose

The banking module should cover two different domains:

1. `banks`
   - licensed bank reference registry
   - used for validation, lookup, autofill, and metadata
2. `company_bank_accounts`
   - STREHË's own real bank accounts
   - used on invoices, payment instructions, and future output surfaces

These domains must remain separate.

## Existing base we are keeping

We are keeping and extending the normalized model already present in the repo:

- `public.banks`
- `public.company_bank_accounts`

We are **not** reviving the original legacy model where `banks` behaved like user-owned bank accounts.

## Target model

### `public.banks`

Licensed-bank registry.

Required fields:

- `id`
- `name`
- `swift_code`
- `country`
- `is_active`

Recommended extensions:

- `short_name`
- `country_code`
- `license_source`
- `license_checked_at`
- `display_order`
- `notes`

### `public.bank_identifiers`

Detection and validation rules for matching typed values to a bank.

Required fields:

- `id`
- `bank_id`
- `identifier_type`
  - `iban_prefix`
  - `account_prefix`
  - `card_bin`
- `value`
- `value_end` nullable
- `scheme` nullable
- `country_code` nullable
- `priority`
- `is_active`
- `source`
- `checked_at`
- `notes`
- `created_at`
- `updated_at`

This table is the missing layer that allows:

- IBAN-based detection
- account-number detection
- card BIN detection

without polluting `banks` itself.

### `public.company_bank_accounts`

Company-owned bank accounts referencing `banks`.

Required fields:

- `id`
- `bank_id`
- `account_name`
- `bank_name_snapshot`
- `iban`
- `swift`
- `currency`
- `is_primary`
- `show_on_invoice`
- `is_active`
- `notes`
- `created_at`
- `updated_at`

## UX rules

### Company bank accounts

This is an admin-managed settings surface.

The user should:

- choose a bank from the licensed-bank registry
- enter account details
- choose whether the account is primary
- choose whether the account appears on invoices

### Future client/vendor banking entry

This is not being connected yet, but the intended behavior is already fixed:

- user types an IBAN/account number or card number
- system normalizes it
- system validates it
- system attempts bank detection using `bank_identifiers`
- detected bank is suggested/autofilled
- user may still edit the bank manually

### What detection may return

Safe outputs:

- bank name
- bank short label
- SWIFT/BIC if known
- country if known
- card scheme if the input is a card number
- match confidence / source rule

Not promised:

- account holder identity
- live account/card data
- balance or ownership verification

## Scope boundaries

In scope now:

- licensed Kosovo banks registry
- company bank accounts
- identifier rule model for detection
- IBAN/account/card validation architecture

Out of scope for now:

- client/vendor wiring
- live third-party bank verification
- card issuer lookups beyond what is stored in our own reference rules
- PDF redesign

## Current known source

The official licensed-banks list should come from the Central Bank of Kosovo.

Reference files in this repo:

- `docs/banking/kosovo_licensed_banks.csv`

Primary source used:

- CBK licensed institutions PDF, published October 8, 2025

## Verified identifier rules seeded first

We intentionally seed only identifier rules that we can verify from official
bank sources.

Initial verified support:

- `NLB Bank`
  - IBAN prefix: `XK0517`
  - account prefix: `17`
  - SWIFT/BIC: `NLPRXKPR`
- `TEB J.S.C.`
  - IBAN prefix: `XK0520`
  - account prefix: `20`
  - SWIFT/BIC: `TEBKXKPR`

Why conservative:

- the detector should never pretend to know a bank when we have not verified
  the rule
- more banks can be added through the detection-rules admin UI as soon as we
  confirm their official prefixes

## Recommended implementation order

1. Extend schema:
   - add bank registry metadata fields
   - add `bank_identifiers`
   - add final company-account support fields
2. Seed/normalize Kosovo banks
3. Clean settings structure around:
   - company bank accounts
   - licensed banks registry
4. Add bank detection service logic
5. Only then connect client/vendor banking flows
