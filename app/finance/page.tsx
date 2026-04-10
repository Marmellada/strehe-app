import Link from "next/link";
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
  FormField,
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

      <Alert variant="info">
        <AlertTitle>How the filters work</AlertTitle>
        <AlertDescription className="space-y-1">
          <div>
          <strong className="text-foreground">Invoice metrics</strong> are filtered by{" "}
          <span className="font-medium text-foreground">issue date</span>.
          </div>
          <div>
          <strong className="text-foreground">Payment metrics</strong> are filtered by{" "}
          <span className="font-medium text-foreground">payment date</span>.
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6">
        <form method="GET" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField id="dateFrom" label="Date From">
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              defaultValue={filters.dateFrom}
              className="input w-full"
            />
          </FormField>

          <FormField id="dateTo" label="Date To">
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              defaultValue={filters.dateTo}
              className="input w-full"
            />
          </FormField>

          <FormField id="clientId" label="Client">
            <select
              id="clientId"
              name="clientId"
              defaultValue={filters.clientId}
              className="input w-full"
            >
              <option value="">All clients</option>
              {filterOptions.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="propertyId" label="Property">
            <select
              id="propertyId"
              name="propertyId"
              defaultValue={filters.propertyId}
              className="input w-full"
            >
              <option value="">All properties</option>
              {filterOptions.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">Apply Filters</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/finance">Reset</Link>
          </Button>
        </div>
      </form>
      </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="border-b">
          <h2 className="text-lg font-semibold text-foreground">
            Open Receivables
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice dataset includes only <span className="font-medium text-foreground">document_type = invoice</span>.
            Credit notes affect settlement only through the shared settlement helper.
          </p>
        </CardHeader>

        {receivables.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No open receivables"
              description="No invoices match the current filter set with remaining balance above zero."
            />
          </div>
        ) : (
          <TableShell className="rounded-none border-x-0 border-b-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Credit Notes</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {receivables.map((row) => (
                  <TableRow
                    key={row.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="font-medium text-foreground">
                      {row.invoiceNumber || "Draft Invoice"}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {row.clientName}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {row.propertyTitle}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatDate(row.issueDate)}
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>

                    <TableCell className="text-right font-medium text-foreground">
                      {formatMoney(row.totalCents)}
                    </TableCell>

                    <TableCell className="text-right text-muted-foreground">
                      {formatMoney(row.paidCents)}
                    </TableCell>

                    <TableCell className="text-right text-muted-foreground">
                      {formatMoney(row.issuedCreditNotesCents)}
                    </TableCell>

                    <TableCell className="text-right font-semibold text-foreground">
                      {formatMoney(row.remainingCents)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/billing/${row.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
