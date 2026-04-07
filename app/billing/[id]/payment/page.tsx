import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PaymentForm } from "@/components/billing/PaymentForm";
import { recordPayment } from "@/app/billing/actions";
import {
  computeSettlement,
  sumAmountCents,
  sumIssuedCreditNoteCents,
} from "@/lib/billing/settlement";

function centsToEur(cents: number) {
  return (cents || 0) / 100;
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_cents, status, document_type")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    notFound();
  }

  const [{ data: payments }, { data: issuedCreditNotes }, { data: banks, error: banksError }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("amount_cents")
        .eq("invoice_id", invoice.id),

      supabase
        .from("invoices")
        .select("status, total_cents")
        .eq("document_type", "credit_note")
        .eq("original_invoice_id", invoice.id),

      supabase
        .from("banks")
        .select("id, name, swift_code")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

  if (banksError) {
    throw new Error(banksError.message);
  }

  const amountPaid = sumAmountCents(payments || []);
  const issuedCreditNotesTotal = sumIssuedCreditNoteCents(
    (issuedCreditNotes || []) as Array<{ status?: string | null; total_cents?: number | null }>
  );

  const settlement = computeSettlement({
    totalCents: invoice.total_cents || 0,
    paymentsCents: amountPaid,
    issuedCreditNotesCents: issuedCreditNotesTotal,
  });

  const balanceDue = settlement.remainingCents;

  if (invoice.document_type !== "invoice") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Record Payment"
          description={`Document ${invoice.invoice_number || "Draft Document"}`}
        />

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Payments can only be recorded for invoices.
            </p>

            <div className="mt-4">
              <Button asChild variant="outline">
                <Link href={`/billing/${invoice.id}`}>Back to Document</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status !== "issued") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Record Payment"
          description={`Invoice ${invoice.invoice_number || "Draft Invoice"}`}
        />

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Payments can only be recorded for invoices in <strong>issued</strong> status.
            </p>

            <div className="mt-4">
              <Button asChild variant="outline">
                <Link href={`/billing/${invoice.id}`}>Back to Invoice</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (balanceDue <= 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Record Payment"
          description={`Invoice ${invoice.invoice_number}`}
        />

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This invoice has no remaining balance after payments and issued credit notes.
            </p>

            <div className="mt-4">
              <Button asChild variant="outline">
                <Link href={`/billing/${invoice.id}`}>Back to Invoice</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Record Payment"
        description={`Invoice ${invoice.invoice_number}`}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              €{centsToEur(settlement.totalCents).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-semibold"
              style={{ color: "var(--brand-green)" }}
            >
              €{centsToEur(settlement.paymentsCents).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Credit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              €{centsToEur(settlement.issuedCreditNotesCents).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Balance Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-semibold"
              style={{ color: "var(--brand-red)" }}
            >
              €{centsToEur(settlement.remainingCents).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Payment</CardTitle>
        </CardHeader>

        <CardContent>
          <PaymentForm
            invoiceId={invoice.id}
            balanceDueCents={settlement.remainingCents}
            banks={(banks || []).map((bank: any) => ({
              id: bank.id,
              name: bank.name,
              swift_code: bank.swift_code,
            }))}
            action={recordPayment}
          />
        </CardContent>
      </Card>
    </div>
  );
}