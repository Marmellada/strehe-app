import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompanySettingsForm } from '@/components/settings/CompanySettingsForm';

export const metadata = {
  title: 'General Settings - STREHË',
  description: 'Manage your company information and settings',
};

export default async function GeneralSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Settings"
        description="Manage your company information, branding, and contact details"
      />

      <CompanySettingsForm initialData={companySettings} userId={user.id} />
    </div>
  );
}