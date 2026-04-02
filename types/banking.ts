export interface BankAccount {
  bank_id: string
  bank_name: string
  account_number?: string | null
  iban: string
  swift_bic?: string | null
  is_primary?: boolean | null
}