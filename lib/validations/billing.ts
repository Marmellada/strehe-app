import { z } from 'zod'

// Invoice validation schema
export const createInvoiceSchema = z.object({
  invoice_type: z.enum(['monthly_rent', 'utilities', 'maintenance', 'other']),
  property_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  issue_date: z.string().min(1, 'Issue date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  line_items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be positive'),
    unit_price: z.number().min(0, 'Unit price must be non-negative'),
    tax_rate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100'),
  })).min(1, 'At least one line item is required'),
  notes: z.string().optional(),
  payment_terms: z.string().optional(),
}).refine((data) => {
  // Validate based on invoice type
  if (data.invoice_type === 'monthly_rent') {
    return data.property_id && data.unit_id && data.tenant_id
  }
  if (data.invoice_type === 'utilities' || data.invoice_type === 'maintenance') {
    return data.property_id && data.unit_id
  }
  if (data.invoice_type === 'other') {
    return data.client_id
  }
  return true
}, {
  message: 'Required fields missing for selected invoice type',
  path: ['invoice_type'],
})

// Bank Account validation schema
export const bankAccountSchema = z.object({
  bank_id: z.string().uuid().optional(),
  bank_name: z.string().min(1, 'Bank name is required'),
  account_name: z.string().optional(),
  account_number: z.string().optional(),
  iban: z.string()
    .min(1, 'IBAN is required')
    .regex(/^XK\d{18}$/, 'IBAN must be in format: XK followed by 18 digits'),
  swift_bic: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type BankAccountInput = z.infer<typeof bankAccountSchema>
