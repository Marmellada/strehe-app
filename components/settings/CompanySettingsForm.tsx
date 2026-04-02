'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/Alert';
import { createOrUpdateCompany } from '@/lib/actions/settings';
import type { Database } from '@/types/supabase';

type CompanySettings = Database['public']['Tables']['company_settings']['Row'];

interface CompanySettingsFormProps {
  initialData: CompanySettings | null;
  userId: string;
}

export function CompanySettingsForm({
  initialData,
  userId,
}: CompanySettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createOrUpdateCompany(formData, userId);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Company settings saved successfully.');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Company Information</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="Company Name"
            name="company_name"
            placeholder="STREHË Prona"
            defaultValue={initialData?.company_name ?? ''}
            required
          />

          <FormInput
            label="VAT Number"
            name="vat_number"
            placeholder="600123456"
            defaultValue={initialData?.vat_number ?? ''}
          />

          <FormInput
            label="Currency"
            name="currency"
            placeholder="EUR"
            defaultValue={initialData?.currency ?? 'EUR'}
          />

          <FormInput
            label="VAT Rate"
            name="vat_rate"
            type="number"
            step="0.01"
            placeholder="18.00"
            defaultValue={initialData?.vat_rate?.toString() ?? '18.00'}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Contact Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="Email"
            name="email"
            type="email"
            placeholder="info@strehe.com"
            defaultValue={initialData?.email ?? ''}
          />

          <FormInput
            label="Phone"
            name="phone"
            type="tel"
            placeholder="+383 xx xxx xxx"
            defaultValue={initialData?.phone ?? ''}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Address</h3>
        <div className="grid grid-cols-1 gap-4">
          <FormInput
            label="Street Address"
            name="address"
            placeholder="Rr. Xhabir Toqani, Bb1/5"
            defaultValue={initialData?.address ?? ''}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label="City"
              name="city"
              placeholder="Prishtinë"
              defaultValue={initialData?.city ?? ''}
            />

            <FormInput
              label="Country"
              name="country"
              placeholder="Kosovo"
              defaultValue={initialData?.country ?? 'Kosovo'}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Branding</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="logo">Company Logo</Label>
            <input
              type="file"
              id="logo"
              name="logo"
              accept="image/*"
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-sm text-gray-500">
              Recommended: PNG or SVG, max 2MB
            </p>
          </div>

          {initialData?.logo_url ? (
            <div>
              <Label>Current Logo</Label>
              <img
                src={initialData.logo_url}
                alt="Company Logo"
                className="mt-2 h-20 object-contain"
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Tax Settings</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="vat_enabled"
              defaultChecked={initialData?.vat_enabled ?? false}
            />
            <span>VAT enabled</span>
          </label>
        </div>
      </Card>

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Success">
          {success}
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}