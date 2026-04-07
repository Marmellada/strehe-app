import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";

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

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Manage billing documents"
        actions={
          <Link href="/billing/new">
            <Button>Create Invoice</Button>
          </Link>
        }
      />

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
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="border-b">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Document
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Client
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((invoice) => {
                const client = getSingleRelation(invoice.client);
                const clientName =
                  client?.company_name || client?.full_name || "—";

                return (
                  <tr
                    key={invoice.id}
                    className="border-b last:border-none transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {getDocumentLabel(invoice)}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {clientName}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          invoice.document_type === "credit_note"
                            ? "danger"
                            : "info"
                        }
                      >
                        {invoice.document_type === "credit_note"
                          ? "Credit Note"
                          : "Invoice"}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(invoice.status || "draft")}>
                        {formatStatusLabel(invoice.status || "draft")}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right font-medium">
                      €{centsToEur(invoice.total_cents).toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {invoice.created_at
                        ? new Date(invoice.created_at).toLocaleDateString("en-GB")
                        : "—"}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link href={`/billing/${invoice.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}