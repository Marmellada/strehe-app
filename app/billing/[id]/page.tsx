import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, FileText, Plus, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DeleteInvoiceButton } from "@/components/billing/DeleteInvoiceButton";
import { UpdateInvoiceStatusButton } from "@/components/billing/UpdateInvoiceStatusButton";

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
    { data: settings },
    { data: banksRaw },
    { data: creditNotesRaw, error: creditNotesError },
    { data: originalInvoice },
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
      .from("general_settings")
      .select(`
        company_name,
        company_address,
        company_city,
        company_postal_code,
        company_country,
        company_email,
        company_phone,
        company_vat_number
      `)
      .single(),

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

  if (creditNotesError) {
    throw new Error(creditNotesError.message);
  }

  const bankMap = new Map(
    (banksRaw || []).map((bank: any) => [bank.id, bank])
  );

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

  const amountPaid =
    payments.reduce(
      (sum: number, payment: { amount_cents: number | null }) =>
        sum + (payment.amount_cents || 0),
      0
    ) || 0;

  const issuedCreditNotesTotal =
    creditNotes.reduce(
      (sum: number, creditNote) =>
        creditNote.status === "issued" ? sum + (creditNote.total_cents || 0) : sum,
      0
    ) || 0;

  const balanceDue =
    invoice.document_type === "invoice"
      ? Math.max(0, (invoice.total_cents || 0) - amountPaid - issuedCreditNotesTotal)
      : 0;

  const clientName = client?.company_name || client?.full_name || "N/A";
  const clientAddrress = client ? formatAddress(client) : "N/A";

  const propertyLabel = property?.title || "—";
  const propertyAddress = property ? formatAddress(property) : "—";

  const companyAddress = settings
    ? [
        settings.company_address,
        settings.company_city,
        settings.company_postal_code,
        settings.company_country,
      ]
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/billing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{documentTitle}</h1>
              <Badge variant="secondary" className="capitalize">
                {status}
              </Badge>
              <Badge
                variant={documentType === "credit_note" ? "destructive" : "secondary"}
              >
                {documentType === "credit_note" ? "credit note" : "invoice"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {documentType === "credit_note"
                ? "Credit note linked to an original invoice"
                : `Client invoice${property ? " linked to a property" : ""}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/billing/${invoice.id}/pdf`} target="_blank">
              <FileText className="mr-2 h-4 w-4" />
              Open PDF
            </Link>
          </Button>

          {documentType === "invoice" && status === "draft" && (
            <>
              <Link href={`/billing/${invoice.id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <DeleteInvoiceButton invoiceId={invoice.id} />
            </>
          )}

          {documentType === "credit_note" && status === "draft" && (
            <DeleteInvoiceButton invoiceId={invoice.id} />
          )}

          {documentType === "invoice" && status === "issued" && balanceDue > 0 && (
            <Link href={`/billing/${invoice.id}/payment`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </Link>
          )}

          {documentType === "invoice" && (status === "issued" || status === "paid") && (
            <Link href={`/billing/${invoice.id}/credit-note/new`}>
              <Button variant="outline">
                <ReceiptText className="mr-2 h-4 w-4" />
                Create Credit Note
              </Button>
            </Link>
          )}
        </div>
      </div>

      {status === "draft" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-900">
            This {documentType === "credit_note" ? "credit note" : "invoice"} is in draft status.
            Issue it when it is ready.
          </p>
          <UpdateInvoiceStatusButton
            invoiceId={invoice.id}
            newStatus="issued"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">From</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{settings?.company_name || "Company Name"}</p>
            <p className="text-muted-foreground">{companyAddress}</p>
            {settings?.company_email && (
              <p className="text-muted-foreground">{settings.company_email}</p>
            )}
            {settings?.company_phone && (
              <p className="text-muted-foreground">{settings.company_phone}</p>
            )}
            {settings?.company_vat_number && (
              <p className="text-muted-foreground">
                VAT: {settings.company_vat_number}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Bill To</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{clientName}</p>
            <p className="text-muted-foreground">{clientAddrress || "N/A"}</p>
            {client?.email && (
              <p className="text-muted-foreground">{client.email}</p>
            )}
            {client?.phone && (
              <p className="text-muted-foreground">{client.phone}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Document Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Number</p>
              <p className="font-medium">{invoice.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.due_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">
                {documentType === "credit_note" ? "Credit Note" : "Invoice"}
              </p>
            </div>
            {documentType === "credit_note" && originalInvoice && (
              <div>
                <p className="text-muted-foreground">Original Invoice</p>
                <Link href={`/billing/${originalInvoice.id}`} className="font-medium underline">
                  {originalInvoice.invoice_number || "Open invoice"}
                </Link>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-muted-foreground">Property</p>
              <p className="font-medium">{propertyLabel}</p>
              {property && (
                <p className="text-muted-foreground">{propertyAddress}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Financial Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {documentType === "credit_note"
                  ? formatCreditMoney(invoice.subtotal_cents)
                  : formatMoney(invoice.subtotal_cents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                VAT ({invoice.vat_rate}%)
              </span>
              <span>
                {documentType === "credit_note"
                  ? formatCreditMoney(invoice.vat_amount_cents)
                  : formatMoney(invoice.vat_amount_cents)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>{documentType === "credit_note" ? "Credit Total" : "Total"}</span>
              <span>
                {documentType === "credit_note"
                  ? formatCreditMoney(invoice.total_cents)
                  : formatMoney(invoice.total_cents)}
              </span>
            </div>

            {documentType === "invoice" && (
              <>
                <div className="flex justify-between pt-2 text-green-700">
                  <span>Paid</span>
                  <span>{formatMoney(amountPaid)}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>Credit Notes</span>
                  <span>
                    {issuedCreditNotesTotal > 0
                      ? formatCreditMoney(issuedCreditNotesTotal)
                      : "€0.00"}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Balance Due</span>
                  <span className={balanceDue > 0 ? "text-red-600" : "text-green-700"}>
                    {formatMoney(balanceDue)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Line Items</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Description
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  Quantity
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(invoiceItems || []).length ? (
                (invoiceItems || []).map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">
                      {documentType === "credit_note"
                        ? formatCreditMoney(item.unit_price_cents)
                        : formatMoney(item.unit_price_cents)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {documentType === "credit_note"
                        ? formatCreditMoney(item.total_cents)
                        : formatMoney(item.total_cents)}
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
          <div className="rounded-lg border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Credit Notes</h2>
              {(status === "issued" || status === "paid") && (
                <Link href={`/billing/${invoice.id}/credit-note/new`}>
                  <Button variant="outline">
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Create Credit Note
                  </Button>
                </Link>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Number</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.length ? (
                    creditNotes.map((creditNote) => (
                      <tr key={creditNote.id} className="border-t">
                        <td className="px-4 py-3">
                          {creditNote.status === "draft"
                            ? "—"
                            : creditNote.invoice_number || "—"}
                        </td>
                        <td className="px-4 py-3 capitalize">{creditNote.status}</td>
                        <td className="px-4 py-3">{formatDate(creditNote.issue_date)}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-700">
                          {creditNote.status === "issued"
                            ? formatCreditMoney(creditNote.total_cents)
                            : `(${formatCreditMoney(creditNote.total_cents)})`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/billing/${creditNote.id}`}>Open</Link>
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
                        No credit notes created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Payments</h2>
              {status === "issued" && balanceDue > 0 && (
                <Link href={`/billing/${invoice.id}/payment`}>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Record Payment
                  </Button>
                </Link>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Reference</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Bank</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length ? (
                    payments.map((payment: any) => (
                      <tr key={payment.id} className="border-t">
                        <td className="px-4 py-3">{formatDate(payment.payment_date)}</td>
                        <td className="px-4 py-3 capitalize">
                          {String(payment.payment_method).replace("_", " ")}
                        </td>
                        <td className="px-4 py-3">
                          {payment.reference_number || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {payment.bank?.name
                            ? `${payment.bank.name}${
                                payment.bank.swift_code
                                  ? ` (${payment.bank.swift_code})`
                                  : ""
                              }`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">
                          {formatMoney(payment.amount_cents)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No payments recorded yet.
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
        <div className="rounded-lg border p-6 space-y-2">
          <h2 className="text-lg font-semibold">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </div>
      )}
    </div>
  );
}