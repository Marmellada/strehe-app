import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      status,
      total_amount,
      created_at,
      client:clients(full_name)
    `
    )
    .order("created_at", { ascending: false });

  const hasData = invoices && invoices.length > 0;

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Invoices"
        subtitle="Manage billing documents"
        actions={
          <Link href="/billing/new">
            <Button>Create Invoice</Button>
          </Link>
        }
      />

      {/* Content */}
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
            {/* Header */}
            <thead className="bg-muted/40 text-left">
              <tr className="border-b">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Invoice
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Client
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

            {/* Body */}
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b last:border-none hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    {invoice.invoice_number}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {invoice.client?.[0]?.full_name ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(invoice.status)}>
                      {formatStatusLabel(invoice.status)}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-right font-medium">
                    €{Number(invoice.total_amount ?? 0).toFixed(2)}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <Link href={`/billing/${invoice.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}