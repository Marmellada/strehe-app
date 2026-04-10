import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, FileText, Plus, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DetailField,
  PageHeader,
  SectionCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";
import { DeleteInvoiceButton } from "@/components/billing/DeleteInvoiceButton";
import { UpdateInvoiceStatusButton } from "@/components/billing/UpdateInvoiceStatusButton";
import { formatStatusLabel } from "@/lib/ui/status";
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

type BankRow = {
  id: string;
  name: string | null;
  swift_code: string | null;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  bank_id: string | null;
  amount_cents: number;
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string | null;
};

type PaymentDisplayRow = PaymentRow & {
  bank: BankRow | null;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | string | null;
  unit_price_cents: number | null;
  total_cents: number | null;
  created_at: string | null;
};

function getDocumentTypeBadgeVariant(documentType: DocumentType) {
  return documentType === "credit_note" ? "danger" : "info";
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);

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

  const bankMap = new Map(
    ((banksRaw || []) as BankRow[]).map((bank) => [bank.id, bank])
  );

  const payments =
    ((paymentsRaw || []) as PaymentRow[]).map((payment) => ({
      ...payment,
      bank: payment.bank_id ? bankMap.get(payment.bank_id) || null : null,
    })) satisfies PaymentDisplayRow[];

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

  const clientName =
    invoice.client_name_snapshot ||
    client?.company_name ||
    client?.full_name ||
    "N/A";
  const clientAddress =
    invoice.client_address_snapshot || (client ? formatAddress(client) : "N/A");

  const propertyLabel = property?.title || "—";
  const propertyAddress = property ? formatAddress(property) : "—";

  const companyName =
    settings?.legal_name || settings?.company_name || "Company Name";

  const companyAddress = settings
    ? [settings.address, settings.city, settings.country]
        .filter(Boolean)
        .join(", ")
    : "Not configured";

  const displayPropertyLabel =
    invoice.property_label_snapshot || propertyLabel;
  const displayPropertyAddress =
    invoice.property_address_snapshot || propertyAddress;
  const displayCompanyName = invoice.company_name_snapshot || companyName;
  const displayCompanyAddress =
    invoice.company_address_snapshot || companyAddress;
  const displayCompanyEmail =
    invoice.company_email_snapshot || settings?.email || null;
  const displayCompanyPhone =
    invoice.company_phone_snapshot || settings?.phone || null;
  const displayCompanyVatNumber =
    invoice.company_vat_number_snapshot || settings?.vat_number || null;
  const displayCompanyBusinessNumber =
    invoice.company_business_number_snapshot ||
    settings?.business_number ||
    null;
  const displayClientEmail = invoice.client_email_snapshot || client?.email || null;
  const displayClientPhone = invoice.client_phone_snapshot || client?.phone || null;

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
        <StatusBadge status={status} />
        <Badge variant={getDocumentTypeBadgeVariant(documentType)}>
          {documentType === "credit_note" ? "Credit Note" : "Invoice"}
        </Badge>
      </div>

      {status === "draft" && (
        <Alert variant="info">
          <AlertTitle>Draft document</AlertTitle>
          <AlertDescription className="mb-3">
            This {documentType === "credit_note" ? "credit note" : "invoice"} is
            in draft status. Issue it when it is ready.
          </AlertDescription>
          <UpdateInvoiceStatusButton
            invoiceId={invoice.id}
            newStatus="issued"
          />
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SectionCard title="From">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{displayCompanyName}</p>
            <p className="text-muted-foreground">{displayCompanyAddress}</p>
            {displayCompanyEmail && (
              <p className="text-muted-foreground">{displayCompanyEmail}</p>
            )}
            {displayCompanyPhone && (
              <p className="text-muted-foreground">{displayCompanyPhone}</p>
            )}
            {displayCompanyVatNumber && (
              <p className="text-muted-foreground">
                VAT: {displayCompanyVatNumber}
              </p>
            )}
            {displayCompanyBusinessNumber && (
              <p className="text-muted-foreground">
                Business No: {displayCompanyBusinessNumber}
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Bill To">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{clientName}</p>
            <p className="text-muted-foreground">{clientAddress || "N/A"}</p>
            {displayClientEmail && (
              <p className="text-muted-foreground">{displayClientEmail}</p>
            )}
            {displayClientPhone && (
              <p className="text-muted-foreground">{displayClientPhone}</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Document Details">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailField label="Number" value={invoice.invoice_number || "—"} />
            <DetailField label="Date" value={formatDate(invoice.issue_date)} />
            <DetailField label="Due Date" value={formatDate(invoice.due_date)} />
            <DetailField label="Status" value={formatStatusLabel(status)} />
            <DetailField
              label="Type"
              value={documentType === "credit_note" ? "Credit Note" : "Invoice"}
            />
            {documentType === "credit_note" && originalInvoice && (
              <DetailField
                label="Original Invoice"
                value={
                  <Link
                    href={`/billing/${originalInvoice.id}`}
                    className="font-medium text-foreground underline"
                  >
                    {originalInvoice.invoice_number || "Open invoice"}
                  </Link>
                }
              />
            )}
            <DetailField
              label="Property"
              className="col-span-2"
              value={
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{displayPropertyLabel}</div>
                  {(property || invoice.property_address_snapshot) && (
                    <div className="text-sm text-muted-foreground">
                      {displayPropertyAddress}
                    </div>
                  )}
                </div>
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Financial Summary">
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
        </SectionCard>
      </div>

      <SectionCard title="Line Items" contentClassName="px-0">
        <TableShell className="rounded-none border-x-0 border-b-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {(invoiceItems || []).length ? (
                ((invoiceItems || []) as InvoiceItemRow[]).map((item) => (
                  <TableRow key={item.id} className="transition-colors hover:bg-muted/20">
                    <TableCell className="text-foreground">
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {documentType === "credit_note"
                        ? formatCreditMoney(item.unit_price_cents || 0)
                        : formatMoney(item.unit_price_cents || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {documentType === "credit_note"
                        ? formatCreditMoney(item.total_cents || 0)
                        : formatMoney(item.total_cents || 0)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No line items found.
                  </TableCell>
                </TableRow>
              )}
              </TableBody>
            </Table>
          </div>
        </TableShell>
      </SectionCard>

      {documentType === "invoice" && (
        <>
          <SectionCard
            title="Credit Notes"
            contentClassName="space-y-0 px-0"
          >
            <div className="flex items-center justify-between px-6">
              {(status === "issued" || status === "paid") && (
                <Button asChild variant="outline">
                  <Link href={`/billing/${invoice.id}/credit-note/new`}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Create Credit Note
                  </Link>
                </Button>
              )}
            </div>

            <TableShell className="rounded-none border-x-0 border-b-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {creditNotes.length ? (
                    creditNotes.map((creditNote) => (
                      <TableRow key={creditNote.id} className="transition-colors hover:bg-muted/20">
                        <TableCell className="text-foreground">
                          {creditNote.invoice_number || "Draft Credit Note"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(creditNote.issue_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={creditNote.status} />
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatCreditMoney(creditNote.total_cents || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/billing/${creditNote.id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No credit notes found.
                      </TableCell>
                    </TableRow>
                  )}
                  </TableBody>
                </Table>
              </div>
            </TableShell>
          </SectionCard>

          <SectionCard title="Payments" contentClassName="space-y-0 px-0">
            <div className="flex items-center justify-between px-6">
              {status === "issued" && settlement.remainingCents > 0 && (
                <Button asChild variant="outline">
                  <Link href={`/billing/${invoice.id}/payment`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Record Payment
                  </Link>
                </Button>
              )}
            </div>

            <TableShell className="rounded-none border-x-0 border-b-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {payments.length ? (
                    payments.map((payment) => (
                      <TableRow key={payment.id} className="transition-colors hover:bg-muted/20">
                        <TableCell className="text-muted-foreground">
                          {formatDate(payment.payment_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {String(payment.payment_method).replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.reference_number || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.bank?.name
                            ? `${payment.bank.name}${
                                payment.bank.swift_code
                                  ? ` (${payment.bank.swift_code})`
                                  : ""
                              }`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatMoney(payment.amount_cents || 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No payments found.
                      </TableCell>
                    </TableRow>
                  )}
                  </TableBody>
                </Table>
              </div>
            </TableShell>
          </SectionCard>
        </>
      )}

      {invoice.notes && (
        <SectionCard title="Notes">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </SectionCard>
      )}
    </div>
  );
}
