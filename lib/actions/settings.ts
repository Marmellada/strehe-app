'use server';

import { createClient } from '@/lib/supabase/server';
import { companySettingsSchema } from '@/lib/validations/settings';
import { revalidatePath } from 'next/cache';

export async function createOrUpdateCompany(formData: FormData, userId: string) {
  try {
    const supabase = await createClient();

    // Parse and validate form data
    const validatedData = companySettingsSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      website: formData.get('website'),
      fax: formData.get('fax'),
      address: formData.get('address'),
      city: formData.get('city'),
      postal_code: formData.get('postal_code'),
      country: formData.get('country'),
      registration_number: formData.get('registration_number'),
      vat_number: formData.get('vat_number'),
      tax_id: formData.get('tax_id'),
    });

    // Get user's profile to check for existing company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    let companyId = profile?.company_id;

    if (companyId) {
      // Update existing company
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (updateError) throw updateError;
    } else {
      // Create new company
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({
          ...validatedData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!newCompany) throw new Error('Failed to create company');

      companyId = newCompany.id;

      // Link company to user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userId);

      if (profileError) throw profileError;
    }

    // Handle logo upload if provided
    const logoFile = formData.get('logo') as File;
    if (logoFile && logoFile.size > 0) {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${companyId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // Update company with logo URL
      await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', companyId);
    }

    revalidatePath('/settings/general');
    revalidatePath('/settings/banking');
    
    return { success: true };
  } catch (error: any) {
    console.error('Company settings error:', error);
    
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      return { error: `${firstError.path.join('.')}: ${firstError.message}` };
    }
    
    return { error: error.message || 'Failed to save company settings' };
  }
}
