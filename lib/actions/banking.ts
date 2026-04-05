'use server';

import { createClient } from '@/lib/supabase/server';
import { bankAccountSchema } from '@/lib/validations/billing';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: boolean; error?: string };

function formatZodError(
  validatedFields:
    | { success: true; data: unknown }
    | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } }
): string | null {
  if (validatedFields.success) return null;

  return validatedFields.error.issues
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join(', ');
}

async function getOrCreateBankId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bankName: string,
  swiftBic?: string
): Promise<{ bankId: string | null; error?: string }> {
  const trimmedName = bankName.trim();
  if (!trimmedName) {
    return { bankId: null, error: 'Bank name is required' };
  }

  const { data: existingBank, error: existingBankError } = await supabase
    .from('banks')
    .select('id')
    .ilike('name', trimmedName)
    .maybeSingle();

  if (existingBankError) {
    return { bankId: null, error: existingBankError.message };
  }

  if (existingBank?.id) {
    return { bankId: existingBank.id };
  }

  const { data: createdBank, error: createBankError } = await supabase
    .from('banks')
    .insert({
      name: trimmedName,
      swift_code: swiftBic?.trim() || null,
      country: 'Kosovo',
      is_active: true,
    })
    .select('id')
    .single();

  if (createBankError) {
    return { bankId: null, error: createBankError.message };
  }

  return { bankId: createdBank.id };
}

/**
 * Create a new bank account
 */
export async function createBankAccount(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const rawData = {
      bank_id: (formData.get('bank_id') as string) || undefined,
      bank_name: (formData.get('bank_name') as string) || '',
      account_name: (formData.get('account_name') as string) || undefined,
      account_number: (formData.get('account_number') as string) || undefined,
      iban: (formData.get('iban') as string) || '',
      swift_bic: (formData.get('swift_bic') as string) || undefined,
      is_primary: formData.get('is_primary') === 'true' || formData.get('is_primary') === 'on',
    };

    const validatedFields = bankAccountSchema.safeParse(rawData);

    if (!validatedFields.success) {
      const errorMessage = formatZodError(validatedFields);
      return { success: false, error: errorMessage || 'Invalid form data' };
    }

    const data = validatedFields.data;
    const normalizedIban = data.iban.toUpperCase().replace(/\s/g, '');

    let bankId = data.bank_id || null;

    if (!bankId) {
      const bankResult = await getOrCreateBankId(
  supabase,
  data.bank_name,
  data.swift_bic ?? undefined
);
      if (!bankResult.bankId) {
        return { success: false, error: bankResult.error || 'Failed to resolve bank' };
      }
      bankId = bankResult.bankId;
    }

    const { data: existingAccount, error: existingAccountError } = await supabase
      .from('company_bank_accounts')
      .select('id')
      .eq('iban', normalizedIban)
      .eq('is_active', true)
      .maybeSingle();

    if (existingAccountError) {
      return { success: false, error: existingAccountError.message };
    }

    if (existingAccount) {
      return { success: false, error: 'An account with this IBAN already exists' };
    }

    if (data.is_primary) {
      const { error: demoteError } = await supabase
        .from('company_bank_accounts')
        .update({ is_primary: false })
        .eq('is_primary', true);

      if (demoteError) {
        return { success: false, error: demoteError.message };
      }
    }

    const { error: insertError } = await supabase
      .from('company_bank_accounts')
      .insert({
        bank_id: bankId,
        account_name: data.account_name || data.bank_name,
        iban: normalizedIban,
        is_primary: data.is_primary,
        is_active: true,
      });

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath('/settings/banking');
    return { success: true };
  } catch (error) {
    console.error('Create bank account error:', error);
    return { success: false, error: 'Failed to create bank account' };
  }
}

/**
 * Update an existing bank account
 */
export async function updateBankAccount(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const rawData = {
      bank_id: (formData.get('bank_id') as string) || undefined,
      bank_name: (formData.get('bank_name') as string) || '',
      account_name: (formData.get('account_name') as string) || undefined,
      account_number: (formData.get('account_number') as string) || undefined,
      iban: (formData.get('iban') as string) || '',
      swift_bic: (formData.get('swift_bic') as string) || undefined,
      is_primary: formData.get('is_primary') === 'true' || formData.get('is_primary') === 'on',
    };

    const validatedFields = bankAccountSchema.safeParse(rawData);

    if (!validatedFields.success) {
      const errorMessage = formatZodError(validatedFields);
      return { success: false, error: errorMessage || 'Invalid form data' };
    }

    const data = validatedFields.data;
    const normalizedIban = data.iban.toUpperCase().replace(/\s/g, '');

    let bankId = data.bank_id || null;

    if (!bankId) {
    const bankResult = await getOrCreateBankId(
  supabase,
  data.bank_name,
  data.swift_bic ?? undefined
);
      if (!bankResult.bankId) {
        return { success: false, error: bankResult.error || 'Failed to resolve bank' };
      }
      bankId = bankResult.bankId;
    }

    const { data: existingAccount, error: existingAccountError } = await supabase
      .from('company_bank_accounts')
      .select('id')
      .eq('iban', normalizedIban)
      .eq('is_active', true)
      .neq('id', id)
      .maybeSingle();

    if (existingAccountError) {
      return { success: false, error: existingAccountError.message };
    }

    if (existingAccount) {
      return { success: false, error: 'An account with this IBAN already exists' };
    }

    if (data.is_primary) {
      const { error: demoteError } = await supabase
        .from('company_bank_accounts')
        .update({ is_primary: false })
        .eq('is_primary', true)
        .neq('id', id);

      if (demoteError) {
        return { success: false, error: demoteError.message };
      }
    }

    const { error: updateError } = await supabase
      .from('company_bank_accounts')
      .update({
        bank_id: bankId,
        account_name: data.account_name || data.bank_name,
        iban: normalizedIban,
        is_primary: data.is_primary,
      })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/settings/banking');
    revalidatePath(`/settings/banking/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Update bank account error:', error);
    return { success: false, error: 'Failed to update bank account' };
  }
}

/**
 * Deactivate a bank account (soft delete)
 */
export async function deactivateBankAccount(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: account, error: accountError } = await supabase
      .from('company_bank_accounts')
      .select('is_primary')
      .eq('id', id)
      .single();

    if (accountError) {
      return { success: false, error: accountError.message };
    }

    if (account?.is_primary) {
      return {
        success: false,
        error: 'Cannot deactivate primary account. Set another account as primary first.',
      };
    }

    const { error: updateError } = await supabase
      .from('company_bank_accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/settings/banking');
    return { success: true };
  } catch (error) {
    console.error('Deactivate bank account error:', error);
    return { success: false, error: 'Failed to deactivate bank account' };
  }
}