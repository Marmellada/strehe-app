'use server'

import { createClient } from '@/lib/supabase/server'
import { bankAccountSchema } from '@/lib/validations/billing'
import { revalidatePath } from 'next/cache'

/**
 * Create a new bank account
 */
export async function createBankAccount(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user's company
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return { success: false, error: 'Company not found' }
    }

    // Extract and validate form data
    const rawData = {
      bank_id: formData.get('bank_id') as string || undefined,
      bank_name: formData.get('bank_name') as string,
      account_name: formData.get('account_name') as string || undefined,
      account_number: formData.get('account_number') as string || undefined,
      iban: formData.get('iban') as string,
      swift_bic: formData.get('swift_bic') as string || undefined,
      is_primary: formData.get('is_primary') === 'true',
    }

    const validatedFields = bankAccountSchema.safeParse(rawData)

    if (!validatedFields.success) {
      const errorMessage = validatedFields.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ')
      return { success: false, error: errorMessage }
    }

    const data = validatedFields.data

    // Normalize IBAN (uppercase, no spaces)
    const normalizedIban = data.iban.toUpperCase().replace(/\s/g, '')

    // Check for duplicate IBAN
    const { data: existingAccount } = await supabase
      .from('company_bank_accounts')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('iban', normalizedIban)
      .eq('is_active', true)
      .maybeSingle()

    if (existingAccount) {
      return { success: false, error: 'An account with this IBAN already exists' }
    }

    // If setting as primary, demote existing primary accounts
    if (data.is_primary) {
      await supabase
        .from('company_bank_accounts')
        .update({ is_primary: false })
        .eq('company_id', profile.company_id)
        .eq('is_primary', true)
    }

    // Insert new bank account
    const { error: insertError } = await supabase
      .from('company_bank_accounts')
      .insert({
        company_id: profile.company_id,
        bank_id: data.bank_id || null,
        bank_name: data.bank_name,
        account_name: data.account_name || null,
        account_number: data.account_number || null,
        iban: normalizedIban,
        swift_bic: data.swift_bic || null,
        is_primary: data.is_primary,
        is_active: true,
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      return { success: false, error: insertError.message }
    }

    revalidatePath('/settings/banking')
    return { success: true }
  } catch (error) {
    console.error('Create bank account error:', error)
    return { success: false, error: 'Failed to create bank account' }
  }
}

/**
 * Update an existing bank account
 */
export async function updateBankAccount(
  id: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user's company
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return { success: false, error: 'Company not found' }
    }

    // Extract and validate form data
    const rawData = {
      bank_id: formData.get('bank_id') as string || undefined,
      bank_name: formData.get('bank_name') as string,
      account_name: formData.get('account_name') as string || undefined,
      account_number: formData.get('account_number') as string || undefined,
      iban: formData.get('iban') as string,
      swift_bic: formData.get('swift_bic') as string || undefined,
      is_primary: formData.get('is_primary') === 'true',
    }

    const validatedFields = bankAccountSchema.safeParse(rawData)

    if (!validatedFields.success) {
      const errorMessage = validatedFields.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ')
      return { success: false, error: errorMessage }
    }

    const data = validatedFields.data

    // Normalize IBAN
    const normalizedIban = data.iban.toUpperCase().replace(/\s/g, '')

    // Check for duplicate IBAN (excluding current account)
    const { data: existingAccount } = await supabase
      .from('company_bank_accounts')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('iban', normalizedIban)
      .eq('is_active', true)
      .neq('id', id)
      .maybeSingle()

    if (existingAccount) {
      return { success: false, error: 'An account with this IBAN already exists' }
    }

    // If setting as primary, demote existing primary accounts
    if (data.is_primary) {
      await supabase
        .from('company_bank_accounts')
        .update({ is_primary: false })
        .eq('company_id', profile.company_id)
        .eq('is_primary', true)
        .neq('id', id)
    }

    // Update bank account
    const { error: updateError } = await supabase
      .from('company_bank_accounts')
      .update({
        bank_id: data.bank_id || null,
        bank_name: data.bank_name,
        account_name: data.account_name || null,
        account_number: data.account_number || null,
        iban: normalizedIban,
        swift_bic: data.swift_bic || null,
        is_primary: data.is_primary,
      })
      .eq('id', id)
      .eq('company_id', profile.company_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath('/settings/banking')
    revalidatePath(`/settings/banking/${id}`)
    return { success: true }
  } catch (error) {
    console.error('Update bank account error:', error)
    return { success: false, error: 'Failed to update bank account' }
  }
}

/**
 * Deactivate a bank account (soft delete)
 */
export async function deactivateBankAccount(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user's company
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return { success: false, error: 'Company not found' }
    }

    // Check if account is primary
    const { data: account } = await supabase
      .from('company_bank_accounts')
      .select('is_primary')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single()

    if (account?.is_primary) {
      return { success: false, error: 'Cannot deactivate primary account. Set another account as primary first.' }
    }

    // Deactivate account
    const { error: updateError } = await supabase
      .from('company_bank_accounts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', profile.company_id)

    if (updateError) {
      console.error('Deactivate error:', updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath('/settings/banking')
    return { success: true }
  } catch (error) {
    console.error('Deactivate bank account error:', error)
    return { success: false, error: 'Failed to deactivate bank account' }
  }
}
