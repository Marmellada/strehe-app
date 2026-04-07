import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, FileText, Plus, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteInvoiceButton } from "@/components/billing/DeleteInvoiceButton";
import { UpdateInvoiceStatusButton } from "@/components/billing/UpdateInvoiceStatusButton";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";
import {
  computeSettlement,
  sumAmountCents,
  sumIssuedCreditNoteCents,
} from "@/lib/billing/settlement";

function centsToEur(cents: number) {
  return (cents || 0) / 100;
}

function formatMoney(cents: number) {
  return `€${centsToEur(cents).toFixed(2)}`;
}

function formatCreditMoney(cents: number) {
  return `-€${centsToEur(cents).toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}

function formatAddress(data: {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}) {
  return [
    data.address_line_1,
    data.address_line_2,
    data.city,
    data.postal_code,
    data.country,
  ]
    .filter(Boolean)
    .join(", ");
}

type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";
type DocumentType = "invoice" | "credit_note";

function getDocumentTypeBadgeVariant(documentType: DocumentType) {
  return documentType === "credit_note" ? "danger" : "info";
}

function sectionCardClasses() {
  return "space-y-4 rounded-2xl border bg-card p-6";
}

function tableHeaderCellClasses() {
  return "px-4 py-3 text-left text-sm font-medium text-muted-foreground";
}

function tableHeaderCellRightClasses() {
  return "px-4 py-3 text-right text-sm font-medium text-muted-foreground";
}

function tableRowClasses() {
  return "border-t transition-colors hover:bg-muted/20";
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      client_id,
      property_id,
      subscription_id,
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
      created_at
    `)
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    notFound();
  }

  const [
    { data: client },
    { data: property },
    { data: invoiceItems, error: itemsError },
    { data: paymentsRaw, error: paymentsError },
    { data: settings, error: settingsError },
    { data: banksRaw, error: banksError },
    { data: creditNotesRaw, error: creditNotesError },
    { data: originalInvoice, error: originalInvoiceError },
  ] = await Promise.all([
    supabase
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
      .maybeSingle(),

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
          .maybeSingle()
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
      .order("created_at", { ascending: true }),

    invoice.document_type === "invoice"
      ? supabase
          .from("payments")
          .select(`
            id,
            invoice_id,
            bank_id,
            amount_cents,
            payment_method,
            payment_date,
            reference_number,
            notes,
            created_at
          `)
          .eq("invoice_id", invoice.id)
          .order("payment_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),

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
        vat_enabled,
        vat_number,
        business_number,
        currency
      `)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("banks")
      .select("id, name, swift_code"),

    invoice.document_type === "invoice"
      ? supabase
          .from("invoices")
          .select(`
            id,
            invoice_number,
            status,
            issue_date,
            total_cents
          `)
          .eq("document_type", "credit_note")
          .eq("original_invoice_id", invoice.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    invoice.original_invoice_id
      ? supabase
          .from("invoices")
          .select(`
            id,
            invoice_number,
            status,
            total_cents
          `)
          .eq("id", invoice.original_invoice_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  if (banksError) {
    throw new Error(banksError.message);
  }

  if (creditNotesError) {
    throw new Error(creditNotesError.message);
  }

  if (originalInvoiceError) {
    throw new Error(originalInvoiceError.message);
  }

  const bankMap = new Map((banksRaw || []).map((bank: any) => [bank.id, bank]));

  const payments =
    (paymentsRaw || []).map((payment: any) => ({
      ...payment,
      bank: payment.bank_id ? bankMap.get(payment.bank_id) || null : null,
    })) || [];

  const creditNotes = (creditNotesRaw || []) as Array<{
    id: string;
    invoice_number: string | null;
    status: InvoiceStatus;
    issue_date: string;
    total_cents: number;
  }>;

  const amountPaid = sumAmountCents(payments);
  const issuedCreditNotesTotal = sumIssuedCreditNoteCents(creditNotes);

  const settlement =
    invoice.document_type === "invoice"
      ? computeSettlement({
          totalCents: invoice.total_cents || 0,
          paymentsCents: amountPaid,
          issuedCreditNotesCents: issuedCreditNotesTotal,
        })
      : computeSettlement({
          totalCents: 0,
          paymentsCents: 0,
          issuedCreditNotesCents: 0,
        });

  const balanceDue =
    invoice.document_type === "invoice" ? settlement.remainingCents : 0;

  const clientName = client?.company_name || client?.full_name || "N/A";
  const clientAddress = client ? formatAddress(client) : "N/A";

  const propertyLabel = property?.title || "—";
  const propertyAddress = property ? formatAddress(property) : "—";

  const companyName =
    settings?.legal_name || settings?.company_name || "Company Name";

  const companyAddress = settings
    ? [settings.address, settings.city, settings.country]
        .filter(Boolean)
        .join(", ")
    : "Not configured";

  const status = invoice.status as InvoiceStatus;
  const documentType = invoice.document_type as DocumentType;

  const documentTitle =
    invoice.invoice_number ||
    (status === "draft"
      ? documentType === "credit_note"
        ? "Draft Credit Note"
        : "Draft Invoice"
      : documentType === "credit_note"
        ? "Credit Note"
        : "Invoice");

  return (
    <div className="space-y-6">
      <PageHeader
        title={documentTitle}
        description={
          documentType === "credit_note"
            ? "Credit note linked to an original invoice."
            : `Client invoice${property ? " linked to a property" : ""}.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link href="/billing">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link href={`/billing/${invoice.id}/pdf`} target="_blank">
                <FileText className="mr-2 h-4 w-4" />
                Open PDF
              </Link>
            </Button>

            {documentType === "invoice" && status === "draft" && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/billing/${invoice.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                <DeleteInvoiceButton invoiceId={invoice.id} />
              </>
            )}

            {documentType === "credit_note" && status === "draft" && (
              <DeleteInvoiceButton invoiceId={invoice.id} />
            )}

            {documentType === "invoice" &&
              status === "issued" &&
              balanceDue > 0 && (
                <Button asChild>
                  <Link href={`/billing/${invoice.id}/payment`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Record Payment
                  </Link>
                </Button>
              )}

            {documentType === "invoice" &&
              (status === "issued" || status === "paid") && (
                <Button asChild variant="outline">
                  <Link href={`/billing/${invoice.id}/credit-note/new`}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Create Credit Note
                  </Link>
                </Button>
              )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={getStatusVariant(status)}>
          {formatStatusLabel(status)}
        </Badge>
        <Badge variant={getDocumentTypeBadgeVariant(documentType)}>
          {documentType === "credit_note" ? "Credit Note" : "Invoice"}
        </Badge>
      </div>

      {status === "draft" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-900">
            This {documentType === "credit_note" ? "credit note" : "invoice"} is
            in draft status. Issue it when it is ready.
          </p>
          <UpdateInvoiceStatusButton
            invoiceId={invoice.id}
            newStatus="issued"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className={sectionCardClasses()}>
          <h2 className="text-lg font-semibold text-foreground">From</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{companyName}</p>
            <p className="text-muted-foreground">{companyAddress}</p>
            {settings?.email && (
              <p className="text-muted-foreground">{settings.email}</p>
            )}
            {settings?.phone && (
              <p className="text-muted-foreground">{settings.phone}</p>
            )}
            {settings?.vat_enabled && settings?.vat_number && (
              <p className="text-muted-foreground">
                VAT: {settings.vat_number}
              </p>
            )}
            {settings?.business_number && (
              <p className="text-muted-foreground">
                Business No: {settings.business_number}
              </p>
            )}
          </div>
        </div>

        <div className={sectionCardClasses()}>
          <h2 className="text-lg font-semibold text-foreground">Bill To</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{clientName}</p>
            <p className="text-muted-foreground">{clientAddress || "N/A"}</p>
            {client?.email && (
              <p className="text-muted-foreground">{client.email}</p>
            )}
            {client?.phone && (
              <p className="text-muted-foreground">{client.phone}</p>
            )}
          </div>
        </div>

        <div className={sectionCardClasses()}>
          <h2 className="text-lg font-semibold text-foreground">
            Document Details
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Number</p>
              <p className="font-medium text-foreground">
                {invoice.invoice_number || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium text-foreground">
                {formatDate(invoice.issue_date)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium text-foreground">
                {formatDate(invoice.due_date)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">
                {formatStatusLabel(status)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium text-foreground">
                {documentType === "credit_note" ? "Credit Note" : "Invoice"}
              </p>
            </div>
            {documentType === "credit_note" && originalInvoice && (
              <div>
                <p className="text-muted-foreground">Original Invoice</p>
                <Link
                  href={`/billing/${originalInvoice.id}`}
                  className="font-medium text-foreground underline"
                >
                  {originalInvoice.invoice_number || "Open invoice"}
                </Link>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-muted-foreground">Property</p>
              <p className="font-medium text-foreground">{propertyLabel}</p>
              {property && (
                <p className="text-muted-foreground">{propertyAddress}</p>
              )}
            </div>
          </div>
        </div>

        <div className={sectionCardClasses()}>
          <h2 className="text-lg font-semibold text-foreground">
            Financial Summary
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">
                {documentType === "credit_note"
                  ? formatCreditMoney(invoice.subtotal_cents || 0)
                  : formatMoney(invoice.subtotal_cents || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                VAT ({invoice.vat_rate}%)
              </span>
              <span className="text-foreground">
                {documentType === "credit_note"
                  ? formatCreditMoney(invoice.vat_amount_cents || 0)
                  : formatMoney(invoice.vat_amount_cents || 0)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span className="text-foreground">
                {documentType === "credit_note" ? "Credit Total" : "Total"}
              </span>
              <span className="text-foreground">
                {documentType === "credit_note"
                  ? formatCreditMoney(invoice.total_cents || 0)
                  : formatMoney(invoice.total_cents || 0)}
              </span>
            </div>

            {documentType === "invoice" && (
              <>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-foreground">
                    {formatMoney(settlement.paymentsCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Notes</span>
                  <span className="font-medium text-foreground">
                    {settlement.issuedCreditNotesCents > 0
                      ? formatCreditMoney(settlement.issuedCreditNotesCents)
                      : "€0.00"}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span className="text-foreground">Balance Due</span>
                  <span className="text-foreground">
                    {formatMoney(settlement.remainingCents)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={sectionCardClasses()}>
        <h2 className="text-lg font-semibold text-foreground">Line Items</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className={tableHeaderCellClasses()}>Description</th>
                <th className={tableHeaderCellRightClasses()}>Quantity</th>
                <th className={tableHeaderCellRightClasses()}>Unit Price</th>
                <th className={tableHeaderCellRightClasses()}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoiceItems || []).length ? (
                (invoiceItems || []).map((item: any) => (
                  <tr key={item.id} className={tableRowClasses()}>
                    <td className="px-4 py-3 text-foreground">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {documentType === "credit_note"
                        ? formatCreditMoney(item.unit_price_cents || 0)
                        : formatMoney(item.unit_price_cents || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {documentType === "credit_note"
                        ? formatCreditMoney(item.total_cents || 0)
                        : formatMoney(item.total_cents || 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No line items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {documentType === "invoice" && (
        <>
          <div className={sectionCardClasses()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Credit Notes
              </h2>
              {(status === "issued" || status === "paid") && (
                <Button asChild variant="outline">
                  <Link href={`/billing/${invoice.id}/credit-note/new`}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Create Credit Note
                  </Link>
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className={tableHeaderCellClasses()}>Number</th>
                    <th className={tableHeaderCellClasses()}>Date</th>
                    <th className={tableHeaderCellClasses()}>Status</th>
                    <th className={tableHeaderCellRightClasses()}>Amount</th>
                    <th className={tableHeaderCellRightClasses()}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.length ? (
                    creditNotes.map((creditNote) => (
                      <tr key={creditNote.id} className={tableRowClasses()}>
                        <td className="px-4 py-3 text-foreground">
                          {creditNote.invoice_number || "Draft Credit Note"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(creditNote.issue_date)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getStatusVariant(creditNote.status)}>
                            {formatStatusLabel(creditNote.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {formatCreditMoney(creditNote.total_cents || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/billing/${creditNote.id}`}>
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No credit notes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={sectionCardClasses()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Payments
              </h2>
              {status === "issued" && settlement.remainingCents > 0 && (
                <Button asChild variant="outline">
                  <Link href={`/billing/${invoice.id}/payment`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Record Payment
                  </Link>
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className={tableHeaderCellClasses()}>Date</th>
                    <th className={tableHeaderCellClasses()}>Method</th>
                    <th className={tableHeaderCellClasses()}>Reference</th>
                    <th className={tableHeaderCellClasses()}>Bank</th>
                    <th className={tableHeaderCellRightClasses()}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length ? (
                    payments.map((payment: any) => (
                      <tr key={payment.id} className={tableRowClasses()}>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {String(payment.payment_method).replace("_", " ")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {payment.reference_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {payment.bank?.name
                            ? `${payment.bank.name}${
                                payment.bank.swift_code
                                  ? ` (${payment.bank.swift_code})`
                                  : ""
                              }`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {formatMoney(payment.amount_cents || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No payments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {invoice.notes && (
        <div className={sectionCardClasses()}>
          <h2 className="text-lg font-semibold text-foreground">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </div>
      )}
    </div>
  );
}