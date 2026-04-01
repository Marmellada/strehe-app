// types/billing.ts

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceType = 'client' | 'property';
export type PaymentMethod = 'bank_transfer' | 'cash';

export interface Bank {
  id: string;
  name: string;
  account_number?: string;
  is_active: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  property_id: string | null;
  client_id: string | null;
  user_id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
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
  vat_rate: number;
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
  name: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export interface Client {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

// Helper type for invoice with relations
export interface InvoiceWithRelations extends Invoice {
  properties?: Property | null;
  clients?: Client | null;
  profiles?: Profile | null;
  invoice_items: InvoiceItem[];
  payments: (Payment & {
    banks: Bank | null;
  })[];
}

// Helper type for general settings
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

// Helper functions for currency conversion
export function centsToEur(cents: number): number {
  return cents / 100;
}

export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

// Calculate line item total
export function computeLineItemTotal(
  quantity: number,
  unitPriceCents: number,
  vatRate: number
): {
  subtotal_cents: number;
  vat_amount_cents: number;
  total_cents: number;
} {
  const subtotal_cents = quantity * unitPriceCents;
  const vat_amount_cents = Math.round(subtotal_cents * (vatRate / 100));
  const total_cents = subtotal_cents + vat_amount_cents;

  return {
    subtotal_cents,
    vat_amount_cents,
    total_cents,
  };
}

// Calculate invoice totals from items
export function computeInvoiceTotals(items: InvoiceItem[]): {
  subtotal_cents: number;
  vat_amount_cents: number;
  total_cents: number;
} {
  const subtotal_cents = items.reduce((sum, item) => {
    // Calculate item subtotal without VAT
    const itemSubtotal = item.quantity * item.unit_price_cents;
    return sum + itemSubtotal;
  }, 0);

  const vat_amount_cents = items.reduce((sum, item) => {
    // Calculate VAT for each item based on its VAT rate
    const itemSubtotal = item.quantity * item.unit_price_cents;
    const itemVat = Math.round(itemSubtotal * (item.vat_rate / 100));
    return sum + itemVat;
  }, 0);

  const total_cents = subtotal_cents + vat_amount_cents;

  return {
    subtotal_cents,
    vat_amount_cents,
    total_cents,
  };
}

// Calculate amount paid for an invoice
export function amountPaidCents(payments: Payment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
}

// Calculate balance due for an invoice
export function balanceDueCents(invoice: Invoice, payments: Payment[]): number {
  return invoice.total_cents - amountPaidCents(payments);
}

// Format address helper
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

  return parts.length > 0 ? parts.join(', ') : 'N/A';
}

// Format address multiline helper
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
  
  const cityLine = [data.postal_code, data.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  
  if (data.country) lines.push(data.country);

  return lines;
}

// Validate invoice type and relation
export function validateInvoiceRelation(
  invoiceType: InvoiceType,
  propertyId: string | null,
  clientId: string | null
): { valid: boolean; error?: string } {
  if (invoiceType === 'property') {
    if (!propertyId) {
      return { valid: false, error: 'Property ID is required for property invoices' };
    }
    if (clientId) {
      return { valid: false, error: 'Property invoices cannot have a client ID' };
    }
  } else if (invoiceType === 'client') {
    if (!clientId) {
      return { valid: false, error: 'Client ID is required for client invoices' };
    }
    if (propertyId) {
      return { valid: false, error: 'Client invoices cannot have a property ID' };
    }
  }

  return { valid: true };
}

// Check if invoice is editable
export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === 'draft';
}

// Check if invoice can accept payments
export function canAcceptPayment(status: InvoiceStatus): boolean {
  return status !== 'paid' && status !== 'cancelled';
}

// Calculate if invoice is overdue
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return false;
  }
  
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return dueDate < today;
}

// Get customer info based on invoice type
export function getCustomerInfo(invoice: InvoiceWithRelations): {
  name: string;
  email: string;
  phone?: string;
  address: string;
} | null {
  if (invoice.invoice_type === 'client' && invoice.clients) {
    return {
      name: invoice.clients.full_name,
      email: invoice.clients.email,
      phone: invoice.clients.phone,
      address: formatAddress(invoice.clients),
    };
  } else if (invoice.invoice_type === 'property' && invoice.properties) {
    return {
      name: invoice.properties.name,
      email: 'N/A',
      address: formatAddress(invoice.properties),
    };
  }
  
  return null;
}
