import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompanySettingsForm } from '@/components/settings/CompanySettingsForm';
import { requireRole } from '@/lib/auth/require-role';

export const metadata = {
  title: 'General Settings - STREHË',
  description: 'Manage your company information and settings',
};

export default async function GeneralSettingsPage() {
  const { authUser } = await requireRole(['admin']);
  const supabase = await createClient();

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

      <CompanySettingsForm initialData={companySettings} userId={authUser.id} />
    </div>
  );
}
