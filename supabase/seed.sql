
-- ============================================================================
-- COMPANY BANK ACCOUNTS
-- ============================================================================

-- Primary business account (Raiffeisen)
INSERT INTO public.company_bank_accounts (
  bank_id,
  account_name,
  iban,
  is_primary,
  is_active
) VALUES (
  (SELECT id FROM public.banks WHERE swift_code = 'RBKOXKPR'),
  'Strehe-Prona SHPK - Business Account',
  'XK051270000000000000',
  true,
  true
) ON CONFLICT DO NOTHING;

-- Secondary account (ProCredit) - Optional
INSERT INTO public.company_bank_accounts (
  bank_id,
  account_name,
  iban,
  is_primary,
  is_active
) VALUES (
  (SELECT id FROM public.banks WHERE swift_code = 'PRCBXKPR'),
  'Strehe-Prona SHPK - Savings Account',
  'XK052340000000000000',
  false,
  true
) ON CONFLICT DO NOTHING;
