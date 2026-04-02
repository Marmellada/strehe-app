import { z } from 'zod';

export const companySettingsSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  fax: z.string().optional(),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  postal_code: z.string().optional(),
  country: z.string().min(2, 'Country must be at least 2 characters'),
  registration_number: z.string().optional(),
  vat_number: z.string().optional(),
  tax_id: z.string().optional(),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
