import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

function centsToEur(cents: number | null | undefined) {
  return (cents || 0) / 100;
}

type BillingListRow = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  document_type: "invoice" | "credit_note" | string | null;
  total_cents: number | null;
  created_at: string | null;
  client_name_snapshot: string | null;
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
};

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getDocumentLabel(row: BillingListRow) {
  if (row.invoice_number) return row.invoice_number;

  if (row.document_type === "credit_note") {
    return "Draft Credit Note";
  }

  return "Draft Invoice";
}

export default async function BillingPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      status,
      document_type,
      total_cents,
      created_at,
      client_name_snapshot,
      client:clients (
        full_name,
        company_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const invoices = (data || []) as BillingListRow[];
  const hasData = invoices.length > 0;
  const issuedInvoices = invoices.filter((invoice) => invoice.status === "issued").length;
  const draftInvoices = invoices.filter((invoice) => invoice.status === "draft").length;
  const totalVolume = invoices.reduce(
    (sum, invoice) => sum + (invoice.total_cents || 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Manage billing documents"
        actions={
          <Link href="/billing/new">
            <Button>Create Invoice</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {invoices.length}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {issuedInvoices}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Drafts: {draftInvoices}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              €{centsToEur(totalVolume).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <EmptyState
          title="No invoices yet"
          description="Create your first invoice to start billing clients."
          action={
            <Link href="/billing/new">
              <Button>Create Invoice</Button>
            </Link>
          }
        />
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {invoices.map((invoice) => {
                const client = getSingleRelation(invoice.client);
                const clientName =
                  invoice.client_name_snapshot ||
                  client?.company_name ||
                  client?.full_name ||
                  "—";

                return (
                  <TableRow
                    key={invoice.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="font-medium">
                      {getDocumentLabel(invoice)}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {clientName}
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        status={
                          invoice.document_type === "credit_note"
                            ? "cancelled"
                            : "issued"
                        }
                        fallbackLabel={
                          invoice.document_type === "credit_note"
                            ? "Credit Note"
                            : "Invoice"
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={invoice.status || "draft"} />
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      €{centsToEur(invoice.total_cents).toFixed(2)}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {invoice.created_at
                        ? new Date(invoice.created_at).toLocaleDateString("en-GB")
                        : "—"}
                    </TableCell>

                    <TableCell className="text-right">
                      <Link href={`/billing/${invoice.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </div>
  );
}
