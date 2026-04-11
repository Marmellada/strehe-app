'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/require-role';
import { revalidatePath } from 'next/cache';
import {
  normalizePreviewTheme,
  previewDefaults,
  type PreviewTheme,
} from '@/components/ui/appearance-preview-theme';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

async function ensureCompanySettingsId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: existing, error: existingError } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('company_settings')
    .insert({
      company_name: 'Strehe-Prona',
      appearance_theme: previewDefaults,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  if (!inserted) throw new Error('Failed to create company settings');

  return inserted.id;
}

export async function createOrUpdateCompany(formData: FormData, userId: string) {
  try {
    void userId;
    await requireRole(['admin']);
    const supabase = await createClient();

    const company_name = getString(formData, 'company_name');
    const vatRateRaw = getString(formData, 'vat_rate');
    const vat_rate = vatRateRaw ? Number(vatRateRaw) : null;

    if (!company_name) {
      return { error: 'Company name is required.' };
    }

    if (vatRateRaw && Number.isNaN(vat_rate)) {
      return { error: 'VAT rate must be a valid number.' };
    }

    const payload = {
      company_name,
      email: getNullableString(formData, 'email'),
      phone: getNullableString(formData, 'phone'),
      address: getNullableString(formData, 'address'),
      city: getNullableString(formData, 'city'),
      country: getNullableString(formData, 'country') || 'Kosovo',
      currency: getNullableString(formData, 'currency') || 'EUR',
      vat_enabled: formData.get('vat_enabled') === 'on',
      vat_number: getNullableString(formData, 'vat_number'),
      vat_rate,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    let settingsId = existing?.id ?? null;

    if (settingsId) {
      const { error: updateError } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', settingsId);

      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('company_settings')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!inserted) throw new Error('Failed to create company settings');

      settingsId = inserted.id;
    }

    const logoFile = formData.get('logo') as File | null;
    if (settingsId && logoFile && logoFile.size > 0) {
      if (logoFile.size > MAX_LOGO_BYTES) {
        return { error: 'Logo must be 2MB or smaller.' };
      }

      if (!ALLOWED_LOGO_TYPES.has(logoFile.type)) {
        return { error: 'Logo must be a PNG, JPG, WEBP, or SVG image.' };
      }

      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${settingsId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      const { error: logoUpdateError } = await supabase
        .from('company_settings')
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', settingsId);

      if (logoUpdateError) throw logoUpdateError;
    }

    revalidatePath('/settings/general');
    revalidatePath('/settings/banking');
    
    return { success: true };
  } catch (error: unknown) {
    console.error('Company settings error:', error);

    return {
      error: error instanceof Error ? error.message : 'Failed to save company settings',
    };
  }
}

export async function saveGlobalAppearanceTheme(theme: PreviewTheme) {
  try {
    await requireRole(['admin']);
    const supabase = await createClient();
    const settingsId = await ensureCompanySettingsId(supabase);
    const nextTheme = normalizePreviewTheme(theme);

    const { error } = await supabase
      .from('company_settings')
      .update({
        appearance_theme: nextTheme,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settingsId);

    if (error) throw error;

    revalidatePath('/', 'layout');
    revalidatePath('/settings');
    revalidatePath('/settings/general');
    revalidatePath('/ui-preview');

    return { success: true, theme: nextTheme };
  } catch (error: unknown) {
    console.error('Appearance settings error:', error);

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to save appearance settings',
    };
  }
}
