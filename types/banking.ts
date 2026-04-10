export type BankIdentifierType = "iban_prefix" | "account_prefix" | "card_bin";

export interface BankAccount {
  bank_id: string
  bank_name: string
  account_number?: string | null
  iban: string
  swift_bic?: string | null
  is_primary?: boolean | null
}

export interface BankRegistryBank {
  id: string
  name: string
  short_name?: string | null
  swift_code?: string | null
  country?: string | null
  country_code?: string | null
  is_active?: boolean | null
}

export interface BankIdentifierRule {
  id: string
  bank_id: string
  identifier_type: BankIdentifierType
  value: string
  value_end?: string | null
  scheme?: string | null
  country_code?: string | null
  priority?: number | null
  is_active?: boolean | null
  source?: string | null
  notes?: string | null
}

export interface BankIdentifierRuleWithBank extends BankIdentifierRule {
  bank?: BankRegistryBank | null
}

export type BankInputKind = "iban" | "card_number" | "account_number" | "unknown";

export type CardScheme =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "diners"
  | "unknown";

export interface BankDetectionMatch {
  bankId: string
  bankName: string
  bankShortName?: string | null
  swiftCode?: string | null
  matchedBy: BankIdentifierType
  matchedValue: string
  scheme?: string | null
}

export interface BankDetectionResult {
  rawInput: string
  normalizedInput: string
  kind: BankInputKind
  isValid: boolean
  validationMessage: string
  countryCode?: string | null
  cardScheme?: CardScheme | null
  matchedBank?: BankDetectionMatch | null
  availableRuleCount: number
}
