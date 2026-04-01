"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createInvoiceSchema, type CreateInvoiceInput } from "@/lib/validations/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";

export async function createInvoice(data: CreateInvoiceInput) {
  const supabase = await createClient();

  // Validate input
  const validatedData = createInvoiceSchema.parse(data);

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // Compute totals
  const totals = computeInvoiceTotals(validatedData.items);

  // Start transaction-like operation
  try {
    // 1. Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_type: validatedData.invoice_type,
        property_id: validatedData.property_id,
        tenant_id: validatedData.tenant_id,
        client_id: validatedData.client_id,
        issue_date: validatedData.issue_date,
        due_date: validatedData.due_date,
        subtotal_amount: totals.subtotal,
        vat_amount: totals.totalVat,
        total_amount: totals.total,
        payment_terms: validatedData.payment_terms,
        notes: validatedData.notes,
        bank_id: validatedData.bank_id,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 2. Create line items
    const lineItems = validatedData.items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(lineItems);

    if (itemsError) {
      // Rollback: delete the invoice if items creation fails
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw itemsError;
    }

    revalidatePath("/billing");
    redirect(`/billing/${invoice.id}`);
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId);

  if (error) throw error;

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();

  // Line items will be deleted automatically via CASCADE
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) throw error;

  revalidatePath("/billing");
  redirect("/billing");
}
