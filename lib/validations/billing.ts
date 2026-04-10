import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  vat_rate: z.number().min(0).max(100, "VAT rate must be between 0 and 100"),
  temp_id: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  invoice_type: z.enum(["standard"]).default("standard"),
  client_id: z.string().uuid("Client is required"),
  property_id: z.string().uuid().nullable().optional(),
  subscription_id: z.string().uuid().nullable().optional(),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().min(1, "Due date is required"),
  items: z.array(lineItemSchema).min(1, "At least one line item is required"),
  notes: z.string().nullable().optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.extend({
  invoice_id: z.string().uuid("Invoice id is required"),
});

export const createCreditNoteSchema = z.object({
  original_invoice_id: z.string().uuid("Original invoice is required"),
  issue_date: z.string().min(1, "Issue date is required"),
  notes: z.string().nullable().optional(),
  items: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export const bankAccountSchema = z.object({
  bank_id: z.string().uuid().optional().nullable(),
  bank_name: z.string().min(1, "Bank name is required"),
  bank_name_snapshot: z.string().min(1, "Display bank name is required").optional(),
  account_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  iban: z
    .string()
    .min(1, "IBAN is required")
    .regex(/^XK\d{18}$/, "IBAN must be in format: XK followed by 18 digits"),
  swift_bic: z.string().optional().nullable(),
  show_on_invoice: z.boolean().default(true),
  is_primary: z.boolean().default(false),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
