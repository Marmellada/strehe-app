import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  vat_rate: z.number().min(0).max(100).default(18),
  temp_id: z.string().optional(), // For client-side tracking
});

export const createInvoiceSchema = z.object({
  // Invoice type
  invoice_type: z.enum(["property_tenant", "client"]),

  // Property/Tenant fields (required if invoice_type = property_tenant)
  property_id: z.string().uuid().optional().nullable(),
  tenant_id: z.string().uuid().optional().nullable(),

  // Client field (required if invoice_type = client)
  client_id: z.string().uuid().optional().nullable(),

  // Invoice details
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().min(1, "Due date is required"),
  payment_terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Bank account
  bank_id: z.string().uuid("Please select a bank account"),

  // Line items
  items: z.array(lineItemSchema).min(1, "At least one line item is required"),
}).refine(
  (data) => {
    if (data.invoice_type === "property_tenant") {
      return data.property_id && data.tenant_id;
    }
    if (data.invoice_type === "client") {
      return data.client_id;
    }
    return false;
  },
  {
    message: "Please select property & tenant OR client based on invoice type",
    path: ["invoice_type"],
  }
);

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
