import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";
import { getFinanceOverview } from "@/lib/finance/overview";

type FinancePageSearchParams = Promise<{
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  propertyId?: string;
}>;

function centsToEur(cents: number) {
  return (cents || 0) / 100;
}

function formatMoney(cents: number) {
  return `€${centsToEur(cents).toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: FinancePageSearchParams;
}) {
  const params = await searchParams;

  const data = await getFinanceOverview({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    clientId: params.clientId,
    propertyId: params.propertyId,
  });

  const { filters, filterOptions, summary, receivables } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        description="Read-only operational finance view built from invoice settlement data."
      />

      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <div>
          <strong className="text-foreground">Invoice metrics</strong> are filtered by{" "}
          <span className="font-medium text-foreground">issue date</span>.
        </div>
        <div>
          <strong className="text-foreground">Payment metrics</strong> are filtered by{" "}
          <span className="font-medium text-foreground">payment date</span>.
        </div>
      </div>

      <form method="GET" className="rounded-2xl border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label
              htmlFor="dateFrom"
              className="text-sm font-medium text-foreground"
            >
              Date From
            </label>
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              defaultValue={filters.dateFrom}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="dateTo"
              className="text-sm font-medium text-foreground"
            >
              Date To
            </label>
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              defaultValue={filters.dateTo}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="clientId"
              className="text-sm font-medium text-foreground"
            >
              Client
            </label>
            <select
              id="clientId"
              name="clientId"
              defaultValue={filters.clientId}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {filterOptions.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="propertyId"
              className="text-sm font-medium text-foreground"
            >
              Property
            </label>
            <select
              id="propertyId"
              name="propertyId"
              defaultValue={filters.propertyId}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            >
              <option value="">All properties</option>
              {filterOptions.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="submit">Apply Filters</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/finance">Reset</Link>
          </Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Outstanding Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatMoney(summary.outstandingReceivablesCents)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Payments Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatMoney(summary.paymentsCollectedCents)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Issued Credit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {formatMoney(summary.issuedCreditNotesCents)}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Open Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {summary.openInvoicesCount}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatMoney(summary.openInvoicesTotalCents)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Settled Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {summary.settledInvoicesCount}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatMoney(summary.settledInvoicesTotalCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Open Receivables
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice dataset includes only <span className="font-medium text-foreground">document_type = invoice</span>.
            Credit notes affect settlement only through the shared settlement helper.
          </p>
        </div>

        {receivables.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No open receivables"
              description="No invoices match the current filter set with remaining balance above zero."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Invoice
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Client
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Property
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Issue Date
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Credit Notes
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Remaining
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {receivables.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-none transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.invoiceNumber || "Draft Invoice"}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {row.clientName}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {row.propertyTitle}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.issueDate)}
                    </td>

                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(row.status)}>
                        {formatStatusLabel(row.status)}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatMoney(row.totalCents)}
                    </td>

                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatMoney(row.paidCents)}
                    </td>

                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatMoney(row.issuedCreditNotesCents)}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatMoney(row.remainingCents)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/billing/${row.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
