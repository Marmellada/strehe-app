import Link from "next/link";
import { ArrowLeft, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";
import { centsToEur } from "@/types/billing";

type PaymentsPageSearchParams = Promise<{
  status?: string;
  method?: string;
}>;

type PaymentRow = {
  id: string;
  invoice_id: string;
  company_account_id: string | null;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  amount_cents: number;
  invoices:
    | {
        id: string;
        invoice_number: string | null;
        total_cents: number | null;
      }
    | {
        id: string;
        invoice_number: string | null;
        total_cents: number | null;
      }[]
    | null;
  company_bank_accounts:
    | {
        id: string;
        account_name: string | null;
        account_type: string | null;
        bank_name_snapshot: string | null;
      }
    | {
        id: string;
        account_name: string | null;
        account_type: string | null;
        bank_name_snapshot: string | null;
      }[]
    | null;
  banks:
    | {
        id: string;
        name: string | null;
        account_number: string | null;
      }
    | {
        id: string;
        name: string | null;
        account_number: string | null;
      }[]
    | null;
};

function getSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatMethod(method: string) {
  const labels: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    other: "Other",
  };

  return labels[method] || method.replaceAll("_", " ");
}

function PaymentMethodBadge({ method }: { method: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize leading-none whitespace-nowrap border-border bg-muted text-muted-foreground">
      {formatMethod(method)}
    </span>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: PaymentsPageSearchParams;
}) {
  await requireRole(["admin", "office"]);

  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select(`
      *,
      invoices (
        id,
        invoice_number,
        total_cents
      ),
      company_bank_accounts (
        id,
        account_name,
        account_type,
        bank_name_snapshot
      ),
      banks (
        id,
        name,
        account_number
      )
    `)
    .order("payment_date", { ascending: false });

  if (params.method) {
    query = query.eq("payment_method", params.method);
  }

  const { data: payments, error } = await query;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payment History"
          description="Track all received payments across invoices."
          actions={
            <Link href="/billing">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Billing
              </Button>
            </Link>
          }
        />

        <Alert variant="destructive">
          <AlertTitle>Unable to load payments</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const typedPayments = (payments || []) as PaymentRow[];

  const totalPayments =
    typedPayments.reduce((sum, payment) => sum + (payment.amount_cents || 0), 0) || 0;

  const bankTransfers =
    typedPayments.filter((payment) => payment.payment_method === "bank_transfer")
      .length || 0;

  const cashPayments =
    typedPayments.filter((payment) => payment.payment_method === "cash").length || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="Track all received payments across invoices."
        actions={
          <Link href="/billing">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Billing
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              €{centsToEur(totalPayments).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Bank Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {bankTransfers}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Cash Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {cashPayments}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Method
          </div>

          <Link href="/billing/payments">
            <Button variant={!params.method ? "default" : "outline"} size="sm">
              All
            </Button>
          </Link>

          <Link href="/billing/payments?method=bank_transfer">
            <Button
              variant={params.method === "bank_transfer" ? "default" : "outline"}
              size="sm"
            >
              Bank Transfer
            </Button>
          </Link>

          <Link href="/billing/payments?method=cash">
            <Button
              variant={params.method === "cash" ? "default" : "outline"}
              size="sm"
            >
              Cash
            </Button>
          </Link>

          <Link href="/billing/payments?method=credit_card">
            <Button
              variant={params.method === "credit_card" ? "default" : "outline"}
              size="sm"
            >
              Credit Card
            </Button>
          </Link>

          <Link href="/billing/payments?method=other">
            <Button
              variant={params.method === "other" ? "default" : "outline"}
              size="sm"
            >
              Other
            </Button>
          </Link>
        </div>
      </div>

      <TableShell>
        {typedPayments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No payments found"
              description="Payments will appear here once they are recorded."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {typedPayments.map((payment) => {
                  const invoice = getSingle(payment.invoices);
                  const bank = getSingle(payment.banks);
                  const companyAccount = getSingle(payment.company_bank_accounts);

                  return (
                    <TableRow
                      key={payment.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/billing/${payment.invoice_id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {invoice?.invoice_number || "N/A"}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <PaymentMethodBadge method={payment.payment_method} />
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {companyAccount?.account_name ||
                          companyAccount?.bank_name_snapshot ||
                          bank?.name ||
                          "N/A"}
                      </TableCell>

                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {payment.reference_number || "—"}
                      </TableCell>

                      <TableCell className="text-right font-medium text-foreground">
                        €{centsToEur(payment.amount_cents).toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link href={`/billing/${payment.invoice_id}`}>
                          <Button variant="outline" size="sm">
                            View Invoice
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TableShell>
    </div>
  );
}
