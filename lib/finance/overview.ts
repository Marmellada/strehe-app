// lib/finance/overview.ts

import { createClient } from "@/lib/supabase/server";
import { computeSettlement } from "@/lib/billing/settlement";

export type FinanceOverviewFilters = {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  propertyId?: string;
};

export type FinanceFilterOption = {
  id: string;
  label: string;
};

export type FinanceSummary = {
  outstandingReceivablesCents: number;
  paymentsCollectedCents: number;
  issuedCreditNotesCents: number;
  openInvoicesCount: number;
  openInvoicesTotalCents: number;
  settledInvoicesCount: number;
  settledInvoicesTotalCents: number;
};

export type FinanceReceivableRow = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  issueDate: string | null;
  clientName: string;
  propertyTitle: string;
  totalCents: number;
  paidCents: number;
  issuedCreditNotesCents: number;
  remainingCents: number;
};

export type FinanceOverviewData = {
  filters: {
    dateFrom: string;
    dateTo: string;
    clientId: string;
    propertyId: string;
  };
  filterOptions: {
    clients: FinanceFilterOption[];
    properties: FinanceFilterOption[];
  };
  summary: FinanceSummary;
  receivables: FinanceReceivableRow[];
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  document_type: string | null;
  client_id: string | null;
  property_id: string | null;
  issue_date: string | null;
  total_cents: number | null;
  client:
    | {
        full_name: string | null;
        company_name: string | null;
      }
    | {
        full_name: string | null;
        company_name: string | null;
      }[]
    | null;
  property:
    | {
        title: string | null;
      }
    | {
        title: string | null;
      }[]
    | null;
};

type PaymentRow = {
  invoice_id: string;
  amount_cents: number | null;
  payment_date: string | null;
};

type CreditNoteRow = {
  original_invoice_id: string | null;
  total_cents: number | null;
  status: string | null;
};

type ClientFilterRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
};

type PropertyFilterRow = {
  id: string;
  title: string | null;
};

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function safeCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value);
}

function normalizeDate(value?: string) {
  return value?.trim() || "";
}

function normalizeId(value?: string) {
  return value?.trim() || "";
}

function buildClientLabel(row: ClientFilterRow) {
  return row.company_name || row.full_name || "Unnamed client";
}

function buildPropertyLabel(row: PropertyFilterRow) {
  return row.title || "Untitled property";
}

export async function getFinanceOverview(
  rawFilters: FinanceOverviewFilters = {}
): Promise<FinanceOverviewData> {
  const supabase = await createClient();

  const filters = {
    dateFrom: normalizeDate(rawFilters.dateFrom),
    dateTo: normalizeDate(rawFilters.dateTo),
    clientId: normalizeId(rawFilters.clientId),
    propertyId: normalizeId(rawFilters.propertyId),
  };

  const [{ data: clientsRaw, error: clientsError }, { data: propertiesRaw, error: propertiesError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name")
        .order("full_name"),
      supabase
        .from("properties")
        .select("id, title")
        .order("title"),
    ]);

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  if (propertiesError) {
    throw new Error(propertiesError.message);
  }

  let invoiceQuery = supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      status,
      document_type,
      client_id,
      property_id,
      issue_date,
      total_cents,
      client:clients (
        full_name,
        company_name
      ),
      property:properties (
        title
      )
    `)
    .eq("document_type", "invoice")
.eq("status", "issued")
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.dateFrom) {
    invoiceQuery = invoiceQuery.gte("issue_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    invoiceQuery = invoiceQuery.lte("issue_date", filters.dateTo);
  }

  if (filters.clientId) {
    invoiceQuery = invoiceQuery.eq("client_id", filters.clientId);
  }

  if (filters.propertyId) {
    invoiceQuery = invoiceQuery.eq("property_id", filters.propertyId);
  }

  const { data: invoicesRaw, error: invoicesError } = await invoiceQuery;

  if (invoicesError) {
    throw new Error(invoicesError.message);
  }

  const invoices = (invoicesRaw || []) as InvoiceRow[];
  const invoiceIds = invoices.map((invoice) => invoice.id);

  let payments: PaymentRow[] = [];
  let creditNotes: CreditNoteRow[] = [];

  if (invoiceIds.length > 0) {
    let paymentsQuery = supabase
      .from("payments")
      .select("invoice_id, amount_cents, payment_date")
      .in("invoice_id", invoiceIds);

    if (filters.dateFrom) {
      paymentsQuery = paymentsQuery.gte("payment_date", filters.dateFrom);
    }

    if (filters.dateTo) {
      paymentsQuery = paymentsQuery.lte("payment_date", filters.dateTo);
    }

    const [{ data: paymentsRaw, error: paymentsError }, { data: creditNotesRaw, error: creditNotesError }] =
      await Promise.all([
        paymentsQuery,
        supabase
          .from("invoices")
          .select("original_invoice_id, total_cents, status")
          .eq("document_type", "credit_note")
          .eq("status", "issued")
          .in("original_invoice_id", invoiceIds),
      ]);

    if (paymentsError) {
      throw new Error(paymentsError.message);
    }

    if (creditNotesError) {
      throw new Error(creditNotesError.message);
    }

    payments = (paymentsRaw || []) as PaymentRow[];
    creditNotes = (creditNotesRaw || []) as CreditNoteRow[];
  }

  const paymentsByInvoice = new Map<string, number>();
  for (const payment of payments) {
    const current = paymentsByInvoice.get(payment.invoice_id) || 0;
    paymentsByInvoice.set(
      payment.invoice_id,
      current + safeCents(payment.amount_cents)
    );
  }

  const creditNotesByInvoice = new Map<string, number>();
  for (const creditNote of creditNotes) {
    const originalInvoiceId = creditNote.original_invoice_id;
    if (!originalInvoiceId) continue;

    const current = creditNotesByInvoice.get(originalInvoiceId) || 0;
    creditNotesByInvoice.set(
      originalInvoiceId,
      current + safeCents(creditNote.total_cents)
    );
  }

  const receivablesBase: FinanceReceivableRow[] = invoices.map((invoice) => {
    const client = getSingleRelation(invoice.client);
    const property = getSingleRelation(invoice.property);

    const paidCents = paymentsByInvoice.get(invoice.id) || 0;
    const issuedCreditNotesCents = creditNotesByInvoice.get(invoice.id) || 0;

    const settlement = computeSettlement({
      totalCents: invoice.total_cents || 0,
      paymentsCents: paidCents,
      issuedCreditNotesCents,
    });

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status || "draft",
      issueDate: invoice.issue_date,
      clientName:
        client?.company_name || client?.full_name || "—",
      propertyTitle: property?.title || "—",
      totalCents: settlement.totalCents,
      paidCents: settlement.paymentsCents,
      issuedCreditNotesCents: settlement.issuedCreditNotesCents,
      remainingCents: settlement.remainingCents,
    };
  });

  const receivables = receivablesBase
    .filter((row) => row.remainingCents > 0)
    .sort((a, b) => {
      const aDate = a.issueDate || "";
      const bDate = b.issueDate || "";
      return bDate.localeCompare(aDate);
    });

  const summary = receivablesBase.reduce<FinanceSummary>(
    (acc, row) => {
      acc.outstandingReceivablesCents += row.remainingCents;
      acc.issuedCreditNotesCents += row.issuedCreditNotesCents;

      if (row.remainingCents > 0) {
        acc.openInvoicesCount += 1;
        acc.openInvoicesTotalCents += row.totalCents;
      } else {
        acc.settledInvoicesCount += 1;
        acc.settledInvoicesTotalCents += row.totalCents;
      }

      return acc;
    },
    {
      outstandingReceivablesCents: 0,
      paymentsCollectedCents: payments.reduce(
        (sum, payment) => sum + safeCents(payment.amount_cents),
        0
      ),
      issuedCreditNotesCents: 0,
      openInvoicesCount: 0,
      openInvoicesTotalCents: 0,
      settledInvoicesCount: 0,
      settledInvoicesTotalCents: 0,
    }
  );

  const clientOptions = ((clientsRaw || []) as ClientFilterRow[]).map((client) => ({
    id: client.id,
    label: buildClientLabel(client),
  }));

  const propertyOptions = ((propertiesRaw || []) as PropertyFilterRow[]).map(
    (property) => ({
      id: property.id,
      label: buildPropertyLabel(property),
    })
  );

  return {
    filters,
    filterOptions: {
      clients: clientOptions,
      properties: propertyOptions,
    },
    summary,
    receivables,
  };
}
