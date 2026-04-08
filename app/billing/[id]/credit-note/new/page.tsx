import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { CreditNoteForm } from "@/components/billing/CreditNoteForm";

export default async function NewCreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);

  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      status,
      document_type
    `)
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    notFound();
  }

  if (invoice.document_type !== "invoice") {
    redirect(`/billing/${id}`);
  }

  if (!["issued", "paid"].includes(invoice.status)) {
    redirect(`/billing/${id}`);
  }

  const { data: invoiceItems, error: itemsError } = await supabase
    .from("invoice_items")
    .select(`
      id,
      description,
      quantity,
      unit_price_cents
    `)
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost">
          <Link href={`/billing/${id}`}>← Back to Invoice</Link>
        </Button>
      </div>

      <PageHeader
        title="New Credit Note"
        description={`Create a credit note for ${invoice.invoice_number}`}
      />

      <CreditNoteForm
        originalInvoiceId={invoice.id}
        originalInvoiceNumber={invoice.invoice_number || "Invoice"}
        initialItems={(invoiceItems || []).map((item: any, index: number) => ({
          description: item.description,
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price_cents || 0) / 100,
          vat_rate: 18,
          temp_id: item.id || `item-${index}`,
        }))}
      />
    </div>
  );
}
