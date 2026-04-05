import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type ClientRelation =
  | {
      full_name: string | null;
      company_name: string | null;
    }
  | {
      full_name: string | null;
      company_name: string | null;
    }[]
  | null;

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: "draft" | "issued" | "paid" | "cancelled";
  document_type: "invoice" | "credit_note";
  issue_date: string;
  due_date: string;
  total_cents: number;
  client: ClientRelation;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatPrice(cents: number, documentType: InvoiceRow["document_type"]) {
  const prefix = documentType === "credit_note" ? "-€" : "€";
  return `${prefix}${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getBadgeVariant(status: InvoiceRow["status"]) {
  switch (status) {
    case "draft":
      return "outline" as const;
    case "issued":
      return "secondary" as const;
    case "paid":
      return "default" as const;
    case "cancelled":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function getTypeBadgeVariant(documentType: InvoiceRow["document_type"]) {
  switch (documentType) {
    case "credit_note":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function getClientName(clientRelation: ClientRelation) {
  const client = getSingleRelation(clientRelation);
  if (!client) return "-";
  return client.company_name || client.full_name || "-";
}

function getDocumentDisplayNumber(invoice: InvoiceRow) {
  if (invoice.status === "draft") return "—";
  return invoice.invoice_number || "—";
}

export default async function BillingPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      status,
      document_type,
      issue_date,
      due_date,
      total_cents,
      client:clients!invoices_client_id_fkey (
        full_name,
        company_name
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const invoices = (data || []) as unknown as InvoiceRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Invoices"
        description="Manage invoices and payments"
        actions={
          <Button asChild>
            <Link href="/billing/new">New Invoice</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Billing Documents</CardTitle>
          <CardDescription>
            {invoices.length} document{invoices.length === 1 ? "" : "s"} found
          </CardDescription>
        </CardHeader>

        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState
              title="No billing documents yet"
              description="Create your first invoice to start billing clients."
              action={
                <Button asChild>
                  <Link href="/billing/new">New Invoice</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-3">Number</th>
                    <th className="px-2 py-3">Type</th>
                    <th className="px-2 py-3">Client</th>
                    <th className="px-2 py-3">Status</th>
                    <th className="px-2 py-3">Issue Date</th>
                    <th className="px-2 py-3">Due Date</th>
                    <th className="px-2 py-3">Total</th>
                    <th className="px-2 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="px-2 py-4 font-medium">
                        {getDocumentDisplayNumber(inv)}
                      </td>

                      <td className="px-2 py-4">
                        <Badge variant={getTypeBadgeVariant(inv.document_type)}>
                          {inv.document_type === "credit_note" ? "credit note" : "invoice"}
                        </Badge>
                      </td>

                      <td className="px-2 py-4">{getClientName(inv.client)}</td>

                      <td className="px-2 py-4">
                        <Badge variant={getBadgeVariant(inv.status)}>
                          {inv.status}
                        </Badge>
                      </td>

                      <td className="px-2 py-4">{formatDate(inv.issue_date)}</td>

                      <td className="px-2 py-4">{formatDate(inv.due_date)}</td>

                      <td className="px-2 py-4">
                        {formatPrice(inv.total_cents, inv.document_type)}
                      </td>

                      <td className="px-2 py-4">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/billing/${inv.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}