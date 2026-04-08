import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { generateBillingPdf } from "@/lib/billing/pdf/generateBillingPdf";
import {
  BillingDocumentPdfData,
  BillingLineItemPdfData,
  CompanyBankAccountPdfData,
  CompanyPdfData,
  looksLikePublicUrl,
  safeNumber,
} from "@/components/billing/pdf/shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ClientRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

type PropertyRow = {
  id: string;
  title: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  client_id: string | null;
  property_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: string | null;
  document_type: "invoice" | "credit_note" | string | null;
  original_invoice_id: string | null;
  subtotal_cents: number | null;
  vat_rate: number | null;
  vat_amount_cents: number | null;
  total_cents: number | null;
  notes: string | null;
  created_at: string | null;
  client_name_snapshot: string | null;
  client_email_snapshot: string | null;
  client_phone_snapshot: string | null;
  client_address_snapshot: string | null;
  property_label_snapshot: string | null;
  property_address_snapshot: string | null;
  company_name_snapshot: string | null;
  company_address_snapshot: string | null;
  company_email_snapshot: string | null;
  company_phone_snapshot: string | null;
  company_vat_number_snapshot: string | null;
  company_business_number_snapshot: string | null;
  currency_snapshot: string | null;
  bank_accounts_snapshot: CompanyBankAccountPdfData[] | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  description: string | null;
  quantity: number | null;
  unit_price_cents: number | null;
  total_cents: number | null;
  created_at: string | null;
};

type SettingsRow = {
  id: string;
  company_name: string | null;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  vat_enabled: boolean | null;
  vat_number: string | null;
  vat_rate: string | number | null;
  currency: string | null;
  business_number: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BankAccountRow = {
  id: string;
  account_name: string | null;
  bank_name_snapshot: string | null;
  iban: string;
  swift: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  show_on_invoice: boolean | null;
  created_at: string | null;
  banks:
    | {
        id: string;
        name: string | null;
        swift_code: string | null;
        country: string | null;
      }
    | {
        id: string;
        name: string | null;
        swift_code: string | null;
        country: string | null;
      }[]
    | null;
};

function storagePublicUrlFromPath(
  supabaseUrl: string,
  bucket: string,
  path: string
): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

function resolveLogoUrl(
  logoValue: string | null | undefined,
  supabaseUrl: string
): string | null {
  if (!logoValue) return null;

  if (looksLikePublicUrl(logoValue)) {
    return logoValue;
  }

  const normalized = logoValue.replace(/^\/+/, "");
  const parts = normalized.split("/");

  if (parts.length >= 2) {
    const bucket = parts[0];
    const path = parts.slice(1).join("/");
    return storagePublicUrlFromPath(supabaseUrl, bucket, path);
  }

  return storagePublicUrlFromPath(supabaseUrl, "public", normalized);
}

function centsToAmount(value: number | null | undefined): number {
  return safeNumber(value, 0) / 100;
}

function mapCompanySettings(
  row: SettingsRow,
  supabaseUrl: string
): CompanyPdfData {
  return {
    company_name: row.legal_name ?? row.company_name ?? null,
    address_line_1: row.address ?? null,
    address_line_2: null,
    city: row.city ?? null,
    postal_code: null,
    country: row.country ?? null,
    vat_number: row.vat_enabled ? row.vat_number ?? null : null,
    business_number: row.business_number ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    website: null,
    logo_url: resolveLogoUrl(row.logo_url ?? null, supabaseUrl),
  };
}

function mapCompanyForInvoice(
  invoice: InvoiceRow,
  row: SettingsRow,
  supabaseUrl: string
): CompanyPdfData {
  const fallback = mapCompanySettings(row, supabaseUrl);

  return {
    ...fallback,
    company_name: invoice.company_name_snapshot ?? fallback.company_name,
    address_line_1: invoice.company_address_snapshot ?? fallback.address_line_1,
    email: invoice.company_email_snapshot ?? fallback.email,
    phone: invoice.company_phone_snapshot ?? fallback.phone,
    vat_number: invoice.company_vat_number_snapshot ?? fallback.vat_number,
    business_number:
      invoice.company_business_number_snapshot ?? fallback.business_number,
  };
}

function mapItems(
  rows: InvoiceItemRow[],
  vatRate: number
): BillingLineItemPdfData[] {
  return (rows || []).map((row) => ({
    description: row.description ?? "Line item",
    quantity: safeNumber(row.quantity, 0),
    unit_price: centsToAmount(row.unit_price_cents),
    vat_rate: safeNumber(vatRate, 0),
    line_total: centsToAmount(row.total_cents),
  }));
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function selectAccountsForPdf(
  accounts: CompanyBankAccountPdfData[]
): CompanyBankAccountPdfData[] {
  if (!accounts.length) return [];
  const primary = accounts.find((a) => a.is_primary);
  if (primary) return [primary];
  return accounts;
}

function mapBankAccounts(rows: BankAccountRow[]): CompanyBankAccountPdfData[] {
  const mapped = (rows || []).map((row) => {
    const bank = firstRelation(row.banks);

    return {
      id: row.id,
      account_name: row.account_name ?? null,
      bank_name: row.bank_name_snapshot ?? bank?.name ?? null,
      iban: row.iban,
      swift: row.swift ?? bank?.swift_code ?? null,
      is_primary: !!row.is_primary,
    };
  });

  return selectAccountsForPdf(mapped);
}

function getBankAccountsForInvoice(
  invoice: InvoiceRow,
  bankAccounts: BankAccountRow[]
): CompanyBankAccountPdfData[] {
  if (
    Array.isArray(invoice.bank_accounts_snapshot) &&
    invoice.bank_accounts_snapshot.length > 0
  ) {
    return invoice.bank_accounts_snapshot;
  }

  return mapBankAccounts(bankAccounts);
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await requireRole(["admin", "office"]);

  const { id } = await context.params;

  if (!id || id === "undefined") {
    return NextResponse.json(
      { error: "Invalid billing document id" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    );
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      client_id,
      property_id,
      issue_date,
      due_date,
      status,
      document_type,
      original_invoice_id,
      subtotal_cents,
      vat_rate,
      vat_amount_cents,
      total_cents,
      notes,
      created_at,
      client_name_snapshot,
      client_email_snapshot,
      client_phone_snapshot,
      client_address_snapshot,
      property_label_snapshot,
      property_address_snapshot,
      company_name_snapshot,
      company_address_snapshot,
      company_email_snapshot,
      company_phone_snapshot,
      company_vat_number_snapshot,
      company_business_number_snapshot,
      currency_snapshot,
      bank_accounts_snapshot
    `)
    .eq("id", id)
    .single<InvoiceRow>();

  if (invoiceError || !invoice) {
    return NextResponse.json(
      { error: "Billing document not found" },
      { status: 404 }
    );
  }

  const [
    { data: client },
    { data: property },
    { data: invoiceItems, error: itemsError },
    { data: settings, error: settingsError },
    { data: bankAccounts, error: bankAccountsError },
    { data: originalInvoice },
  ] = await Promise.all([
    invoice.client_id
      ? supabase
          .from("clients")
          .select(`
            id,
            full_name,
            company_name,
            email,
            phone,
            address_line_1,
            address_line_2,
            city,
            postal_code,
            country
          `)
          .eq("id", invoice.client_id)
          .maybeSingle<ClientRow>()
      : Promise.resolve({ data: null, error: null }),

    invoice.property_id
      ? supabase
          .from("properties")
          .select(`
            id,
            title,
            address_line_1,
            address_line_2,
            city,
            postal_code,
            country
          `)
          .eq("id", invoice.property_id)
          .maybeSingle<PropertyRow>()
      : Promise.resolve({ data: null, error: null }),

    supabase
      .from("invoice_items")
      .select(`
        id,
        invoice_id,
        description,
        quantity,
        unit_price_cents,
        total_cents,
        created_at
      `)
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true })
      .returns<InvoiceItemRow[]>(),

    supabase
      .from("company_settings")
      .select(`
        id,
        company_name,
        legal_name,
        email,
        phone,
        address,
        city,
        country,
        logo_url,
        vat_enabled,
        vat_number,
        vat_rate,
        currency,
        business_number,
        created_at,
        updated_at
      `)
      .limit(1)
      .maybeSingle<SettingsRow>(),

    supabase
      .from("company_bank_accounts")
      .select(`
        id,
        account_name,
        bank_name_snapshot,
        iban,
        swift,
        is_primary,
        is_active,
        show_on_invoice,
        created_at,
        banks (
          id,
          name,
          swift_code,
          country
        )
      `)
      .eq("is_active", true)
      .eq("show_on_invoice", true)
      .order("created_at", { ascending: true })
      .returns<BankAccountRow[]>(),

    invoice.original_invoice_id
      ? supabase
          .from("invoices")
          .select(`
            id,
            invoice_number,
            issue_date
          `)
          .eq("id", invoice.original_invoice_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (itemsError) {
    return NextResponse.json(
      { error: "Failed to load line items" },
      { status: 500 }
    );
  }

  if (settingsError || !settings) {
    return NextResponse.json(
      {
        error: "Company settings not found",
        details: settingsError?.message ?? null,
      },
      { status: 500 }
    );
  }

  if (bankAccountsError) {
    return NextResponse.json(
      {
        error: "Failed to load company bank accounts",
        details: bankAccountsError.message,
      },
      { status: 500 }
    );
  }

  const document: BillingDocumentPdfData = {
    id: invoice.id,
    type: invoice.document_type === "credit_note" ? "credit_note" : "invoice",
    number: invoice.invoice_number ?? null,
    issue_date: invoice.issue_date ?? null,
    due_date: invoice.due_date ?? null,
    currency: invoice.currency_snapshot ?? settings.currency ?? "EUR",
    notes: invoice.notes ?? null,
    payment_reference: invoice.invoice_number ?? invoice.id,

    subtotal: centsToAmount(invoice.subtotal_cents),
    vat_total: centsToAmount(invoice.vat_amount_cents),
    total: centsToAmount(invoice.total_cents),

    client: {
      full_name: invoice.client_name_snapshot ? null : client?.full_name ?? null,
      company_name:
        invoice.client_name_snapshot ?? client?.company_name ?? null,
      email: invoice.client_email_snapshot ?? client?.email ?? null,
      phone: invoice.client_phone_snapshot ?? client?.phone ?? null,
      address_line_1:
        invoice.client_address_snapshot ?? client?.address_line_1 ?? null,
      address_line_2: client?.address_line_2 ?? null,
      city: client?.city ?? null,
      postal_code: client?.postal_code ?? null,
      country: client?.country ?? null,
      vat_number: null,
      business_number: null,
    },

    property: property || invoice.property_label_snapshot || invoice.property_address_snapshot
      ? {
          property_code: null,
          title: invoice.property_label_snapshot ?? property?.title ?? null,
          address_line_1:
            invoice.property_address_snapshot ??
            property?.address_line_1 ??
            null,
          address_line_2: property?.address_line_2 ?? null,
          city: property?.city ?? null,
          postal_code: property?.postal_code ?? null,
          country: property?.country ?? null,
        }
      : null,

    company: mapCompanyForInvoice(invoice, settings, supabaseUrl),
    company_bank_accounts: getBankAccountsForInvoice(
      invoice,
      bankAccounts || []
    ),
    items: mapItems(invoiceItems || [], safeNumber(invoice.vat_rate, 0)),

    original_invoice:
      invoice.document_type === "credit_note" && originalInvoice
        ? {
            id: originalInvoice.id,
            number: originalInvoice.invoice_number ?? null,
            issue_date: originalInvoice.issue_date ?? null,
          }
        : null,
  };

  const { bytes, filename } = await generateBillingPdf({ document });
  const pdfBytes = new Uint8Array(bytes);

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
