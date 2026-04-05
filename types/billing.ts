export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";
export type InvoiceType = "standard";
export type DocumentType = "invoice" | "credit_note";
export type PaymentMethod = "bank_transfer" | "cash";

export interface Bank {
  id: string;
  name: string;
  account_number?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface Invoice {
  id: string;
  property_id: string | null;
  client_id: string;
  subscription_id: string | null;
  user_id: string;
  invoice_number: string | null;
  invoice_type: InvoiceType;
  document_type: DocumentType;
  original_invoice_id: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal_cents: number;
  vat_rate: number;
  vat_amount_cents: number;
  total_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  bank_id: string | null;
  amount_cents: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  title: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export interface Client {
  id: string;
  full_name: string | null;
  company_name?: string | null;
  email: string | null;
  phone?: string | null;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email?: string | null;
}

export interface InvoiceWithRelations extends Invoice {
  properties?: Property | null;
  clients?: Client | null;
  profiles?: Profile | null;
  invoice_items: InvoiceItem[];
  payments: (Payment & {
    banks: Bank | null;
  })[];
}

export interface GeneralSettings {
  id: string;
  company_name: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
  company_country?: string;
  company_email?: string;
  company_phone?: string;
  company_vat_number?: string;
  currency: string;
  default_vat_rate: number;
  created_at: string;
  updated_at: string;
}

export function centsToEur(cents: number): number {
  return (cents || 0) / 100;
}

export function eurToCents(eur: number): number {
  return Math.round((eur || 0) * 100);
}

export function amountPaidCents(
  payments: Array<{ amount_cents: number }>
): number {
  return payments.reduce((sum, payment) => sum + (payment.amount_cents || 0), 0);
}

export function balanceDueCents(
  invoice: { total_cents: number },
  payments: Array<{ amount_cents: number }>,
  creditNotes: Array<{ total_cents: number; status?: InvoiceStatus }>
): number {
  const paid = amountPaidCents(payments);
  const credited = creditNotes.reduce((sum, creditNote) => {
    if (creditNote.status && creditNote.status !== "issued") return sum;
    return sum + (creditNote.total_cents || 0);
  }, 0);

  return Math.max(0, (invoice.total_cents || 0) - paid - credited);
}

export function formatAddress(data: {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}): string {
  const parts = [
    data.address_line_1,
    data.address_line_2,
    data.city,
    data.postal_code,
    data.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "N/A";
}

export function formatAddressMultiline(data: {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}): string[] {
  const lines: string[] = [];

  if (data.address_line_1) lines.push(data.address_line_1);
  if (data.address_line_2) lines.push(data.address_line_2);

  const cityLine = [data.postal_code, data.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);

  if (data.country) lines.push(data.country);

  return lines;
}

export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "draft";
}

export function canAcceptPayment(status: InvoiceStatus): boolean {
  return status === "issued";
}