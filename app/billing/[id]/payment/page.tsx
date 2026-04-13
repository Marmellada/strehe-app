import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
} from "@/components/ui";
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
  await requireRole(["admin", "office"]);

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

  const [{ data: payments }, { data: issuedCreditNotes }, { data: accounts, error: accountsError }] =
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
        .from("company_bank_accounts")
        .select("id, account_type, account_name, bank_name_snapshot, swift, is_active")
        .eq("is_active", true)
        .order("account_type", { ascending: true })
        .order("account_name", { ascending: true }),
    ]);

  if (accountsError) {
    throw new Error(accountsError.message);
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
        actions={
          <Button asChild variant="outline">
            <Link href={`/billing/${invoice.id}`}>Back to Invoice</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total"
          value={`€${centsToEur(settlement.totalCents).toFixed(2)}`}
        />
        <StatCard
          title="Paid"
          value={<span className="text-[var(--status-success-text)]">€{centsToEur(settlement.paymentsCents).toFixed(2)}</span>}
        />
        <StatCard
          title="Credit Notes"
          value={`€${centsToEur(settlement.issuedCreditNotesCents).toFixed(2)}`}
        />
        <StatCard
          title="Balance Due"
          value={<span className="text-[var(--status-danger-text)]">€{centsToEur(settlement.remainingCents).toFixed(2)}</span>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Payment</CardTitle>
        </CardHeader>

        <CardContent>
          <PaymentForm
            invoiceId={invoice.id}
            balanceDueCents={settlement.remainingCents}
            banks={((accounts || []) as Array<{
              id: string;
              account_type: "bank" | "cash";
              account_name: string;
              bank_name_snapshot: string | null;
              swift: string | null;
            }>).map((account) => ({
              id: account.id,
              account_type: account.account_type,
              name: account.account_name,
              bank_name: account.bank_name_snapshot,
              swift_code: account.swift,
            }))}
            action={recordPayment}
          />
        </CardContent>
      </Card>
    </div>
  );
}
