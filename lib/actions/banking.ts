'use server';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/require-role';
import { bankAccountSchema } from '@/lib/validations/billing';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: boolean; error?: string };

function normalizeSwiftBic(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

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

function isValidSwiftBic(value: string) {
  return value === '' || /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(value);
}

function buildStoredCashIban(existingValue?: string | null) {
  if (existingValue?.trim()) {
    return existingValue;
  }

  return `CASH-${randomUUID()}`;
}

async function findDuplicateCompanyAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    accountType,
    iban,
    accountName,
    excludeId,
  }: {
    accountType: 'bank' | 'cash';
    iban: string;
    accountName: string;
    excludeId?: string;
  }
): Promise<{ duplicateId: string | null; error?: string }> {
  let query = supabase
    .from('company_bank_accounts')
    .select('id, account_name')
    .eq('account_type', accountType)
    .eq('is_active', true);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  if (accountType === 'cash') {
    query = query.ilike('account_name', accountName.trim());
  } else {
    query = query.eq('iban', iban);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { duplicateId: null, error: error.message };
  }

  return { duplicateId: data?.id ?? null };
}

export async function createLicensedBank(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole(['admin']);
    const supabase = await createClient();

    const name = String(formData.get('name') || '').trim();
    const country = String(formData.get('country') || '').trim() || 'Kosovo';
    const swift_code = normalizeSwiftBic(String(formData.get('swift_code') || ''));

    if (!name) {
      return { success: false, error: 'Bank name is required.' };
    }

    if (!isValidSwiftBic(swift_code)) {
      return { success: false, error: 'SWIFT/BIC must be 8 or 11 characters.' };
    }

    const { data: existing, error: existingError } = await supabase
      .from('banks')
      .select('id')
      .ilike('name', name)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    if (existing) {
      return { success: false, error: 'A bank with this name already exists.' };
    }

    const { error } = await supabase.from('banks').insert({
      name,
      country,
      swift_code: swift_code || null,
      is_active: true,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/banking');
    return { success: true };
  } catch (error) {
    console.error('Create licensed bank error:', error);
    return { success: false, error: 'Failed to create bank.' };
  }
}

export async function updateLicensedBank(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireRole(['admin']);
    const supabase = await createClient();

    const name = String(formData.get('name') || '').trim();
    const country = String(formData.get('country') || '').trim() || 'Kosovo';
    const swift_code = normalizeSwiftBic(String(formData.get('swift_code') || ''));

    if (!name) {
      return { success: false, error: 'Bank name is required.' };
    }

    if (!isValidSwiftBic(swift_code)) {
      return { success: false, error: 'SWIFT/BIC must be 8 or 11 characters.' };
    }

    const { data: existing, error: existingError } = await supabase
      .from('banks')
      .select('id')
      .ilike('name', name)
      .neq('id', id)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    if (existing) {
      return { success: false, error: 'A bank with this name already exists.' };
    }

    const { error } = await supabase
      .from('banks')
      .update({
        name,
        country,
        swift_code: swift_code || null,
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/banking');
    revalidatePath(`/settings/banking/banks/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Update licensed bank error:', error);
    return { success: false, error: 'Failed to update bank.' };
  }
}

export async function deactivateLicensedBank(id: string): Promise<ActionResult> {
  try {
    await requireRole(['admin']);
    const supabase = await createClient();

    const { error } = await supabase
      .from('banks')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/banking');
    revalidatePath(`/settings/banking/banks/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Deactivate licensed bank error:', error);
    return { success: false, error: 'Failed to deactivate bank.' };
  }
}

type RawIdentifierClient = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ error: { message: string } | null }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function normalizeIdentifierValue(value: FormDataEntryValue | null) {
  return String(value || "").trim().toUpperCase();
}

function getIdentifierPayload(formData: FormData) {
  const bank_id = String(formData.get("bank_id") || "").trim();
  const identifier_type = String(formData.get("identifier_type") || "").trim();
  const value = normalizeIdentifierValue(formData.get("value"));
  const value_end = normalizeIdentifierValue(formData.get("value_end")) || null;
  const scheme = String(formData.get("scheme") || "").trim().toLowerCase() || null;
  const country_code =
    normalizeIdentifierValue(formData.get("country_code")) || null;
  const source = String(formData.get("source") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const priorityRaw = String(formData.get("priority") || "").trim();
  const priority = priorityRaw ? Number(priorityRaw) : 100;
  const is_active =
    formData.get("is_active") === "true" || formData.get("is_active") === "on";

  return {
    bank_id,
    identifier_type,
    value,
    value_end,
    scheme,
    country_code,
    source,
    notes,
    priority,
    is_active,
  };
}

function validateIdentifierPayload(payload: ReturnType<typeof getIdentifierPayload>) {
  if (!payload.bank_id) return "Bank is required.";
  if (!payload.identifier_type) return "Identifier type is required.";
  if (!payload.value) return "Start value is required.";
  if (Number.isNaN(payload.priority)) return "Priority must be a valid number.";

  if (payload.identifier_type === "card_bin") {
    if (!/^\d{4,8}$/.test(payload.value)) {
      return "Card BIN rules must use 4 to 8 digits.";
    }
    if (payload.value_end && !/^\d{4,8}$/.test(payload.value_end)) {
      return "Card BIN range end must use 4 to 8 digits.";
    }
  }

  return null;
}

export async function createBankIdentifier(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const rawClient = supabase as unknown as RawIdentifierClient;
    const payload = getIdentifierPayload(formData);
    const validationError = validateIdentifierPayload(payload);

    if (validationError) {
      return { success: false, error: validationError };
    }

    const { error } = await rawClient
      .from("bank_identifiers")
      .insert({
        ...payload,
        checked_at: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/banking/detection");
    return { success: true };
  } catch (error) {
    console.error("Create bank identifier error:", error);
    return { success: false, error: "Failed to create bank identifier." };
  }
}

export async function updateBankIdentifier(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const rawClient = supabase as unknown as RawIdentifierClient;
    const payload = getIdentifierPayload(formData);
    const validationError = validateIdentifierPayload(payload);

    if (validationError) {
      return { success: false, error: validationError };
    }

    const { error } = await rawClient
      .from("bank_identifiers")
      .update({
        ...payload,
        checked_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/banking/detection");
    revalidatePath(`/settings/banking/detection/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Update bank identifier error:", error);
    return { success: false, error: "Failed to update bank identifier." };
  }
}

export async function deactivateBankIdentifier(id: string): Promise<ActionResult> {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const rawClient = supabase as unknown as RawIdentifierClient;

    const { error } = await rawClient
      .from("bank_identifiers")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings/banking/detection");
    revalidatePath(`/settings/banking/detection/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Deactivate bank identifier error:", error);
    return { success: false, error: "Failed to deactivate bank identifier." };
  }
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
      account_type: ((formData.get('account_type') as string) || 'bank') as 'bank' | 'cash',
      bank_id: (formData.get('bank_id') as string) || undefined,
      bank_name:
        (formData.get('bank_name') as string) ||
        (formData.get('bank_name_snapshot') as string) ||
        '',
      bank_name_snapshot:
        (formData.get('bank_name_snapshot') as string) || undefined,
      account_name: (formData.get('account_name') as string) || undefined,
      account_number: (formData.get('account_number') as string) || undefined,
      iban: (formData.get('iban') as string) || '',
      swift_bic:
        (formData.get('swift_bic') as string) ||
        (formData.get('swift') as string) ||
        undefined,
      show_on_invoice:
        formData.get('show_on_invoice') === 'true' ||
        formData.get('show_on_invoice') === 'on',
      is_primary: formData.get('is_primary') === 'true' || formData.get('is_primary') === 'on',
    };

    const validatedFields = bankAccountSchema.safeParse(rawData);

    if (!validatedFields.success) {
      const errorMessage = formatZodError(validatedFields);
      return { success: false, error: errorMessage || 'Invalid form data' };
    }

    const data = validatedFields.data;
    const normalizedIban =
      data.account_type === 'cash'
        ? buildStoredCashIban()
        : data.iban.toUpperCase().replace(/\s/g, '');

    let bankId = data.bank_id || null;

    if (data.account_type === 'bank' && !bankId) {
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

    const duplicateCheck = await findDuplicateCompanyAccount(supabase, {
      accountType: data.account_type,
      iban: normalizedIban,
      accountName:
        data.account_name ||
        data.bank_name_snapshot ||
        (data.account_type === 'cash' ? 'Cash Account' : data.bank_name),
    });

    if (duplicateCheck.error) {
      return { success: false, error: duplicateCheck.error };
    }

    if (duplicateCheck.duplicateId) {
      return {
        success: false,
        error:
          data.account_type === 'cash'
            ? 'An active cash account with this name already exists.'
            : 'An account with this IBAN already exists',
      };
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
        account_type: data.account_type,
        bank_id: bankId,
        account_name:
          data.account_name ||
          data.bank_name_snapshot ||
          (data.account_type === 'cash' ? 'Cash Account' : data.bank_name),
        bank_name_snapshot:
          data.account_type === 'cash'
            ? data.bank_name_snapshot || 'Cash'
            : data.bank_name_snapshot || data.bank_name,
        iban: normalizedIban,
        swift: data.account_type === 'cash' ? null : data.swift_bic?.trim() || null,
        is_primary: data.is_primary,
        is_active: true,
        show_on_invoice: data.account_type === 'cash' ? false : data.show_on_invoice,
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
      account_type: ((formData.get('account_type') as string) || 'bank') as 'bank' | 'cash',
      bank_id: (formData.get('bank_id') as string) || undefined,
      bank_name:
        (formData.get('bank_name') as string) ||
        (formData.get('bank_name_snapshot') as string) ||
        '',
      bank_name_snapshot:
        (formData.get('bank_name_snapshot') as string) || undefined,
      account_name: (formData.get('account_name') as string) || undefined,
      account_number: (formData.get('account_number') as string) || undefined,
      iban: (formData.get('iban') as string) || '',
      swift_bic:
        (formData.get('swift_bic') as string) ||
        (formData.get('swift') as string) ||
        undefined,
      show_on_invoice:
        formData.get('show_on_invoice') === 'true' ||
        formData.get('show_on_invoice') === 'on',
      is_primary: formData.get('is_primary') === 'true' || formData.get('is_primary') === 'on',
    };

    const validatedFields = bankAccountSchema.safeParse(rawData);

    if (!validatedFields.success) {
      const errorMessage = formatZodError(validatedFields);
      return { success: false, error: errorMessage || 'Invalid form data' };
    }

    const data = validatedFields.data;
    const { data: existingAccount, error: existingAccountError } = await supabase
      .from('company_bank_accounts')
      .select('id, account_type, iban')
      .eq('id', id)
      .single();

    if (existingAccountError || !existingAccount) {
      return { success: false, error: existingAccountError?.message || 'Account not found' };
    }

    const normalizedIban =
      data.account_type === 'cash'
        ? buildStoredCashIban(existingAccount.iban)
        : data.iban.toUpperCase().replace(/\s/g, '');

    let bankId = data.bank_id || null;

    if (data.account_type === 'bank' && !bankId) {
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

    const duplicateCheck = await findDuplicateCompanyAccount(supabase, {
      accountType: data.account_type,
      iban: normalizedIban,
      accountName:
        data.account_name ||
        data.bank_name_snapshot ||
        (data.account_type === 'cash' ? 'Cash Account' : data.bank_name),
      excludeId: id,
    });

    if (duplicateCheck.error) {
      return { success: false, error: duplicateCheck.error };
    }

    if (duplicateCheck.duplicateId) {
      return {
        success: false,
        error:
          data.account_type === 'cash'
            ? 'An active cash account with this name already exists.'
            : 'An account with this IBAN already exists',
      };
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
        account_type: data.account_type,
        bank_id: bankId,
        account_name:
          data.account_name ||
          data.bank_name_snapshot ||
          (data.account_type === 'cash' ? 'Cash Account' : data.bank_name),
        bank_name_snapshot:
          data.account_type === 'cash'
            ? data.bank_name_snapshot || 'Cash'
            : data.bank_name_snapshot || data.bank_name,
        iban: normalizedIban,
        swift: data.account_type === 'cash' ? null : data.swift_bic?.trim() || null,
        is_primary: data.is_primary,
        show_on_invoice: data.account_type === 'cash' ? false : data.show_on_invoice,
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

export async function activateBankAccount(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error: updateError } = await supabase
      .from('company_bank_accounts')
      .update({ is_active: true })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/settings/banking');
    revalidatePath(`/settings/banking/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Activate bank account error:', error);
    return { success: false, error: 'Failed to activate bank account' };
  }
}
