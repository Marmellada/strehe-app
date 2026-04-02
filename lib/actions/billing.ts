"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createInvoiceSchema, type CreateInvoiceInput } from "@/lib/validations/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { InvoiceStatus } from "@/types/billing";

export async function createInvoice(data: CreateInvoiceInput) {
  const supabase = await createClient();

  // Validate input
  try {
    const validatedData = createInvoiceSchema.parse(data);

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Compute totals
    const totals = computeInvoiceTotals(validatedData.items);

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

    if (invoiceError) {
      return { error: invoiceError.message };
    }

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
      return { error: itemsError.message };
    }

    revalidatePath("/billing");
    redirect(`/billing/${invoice.id}`);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return { error: error instanceof Error ? error.message : "Failed to create invoice" };
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
  return { success: true };
}

export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient();

  // Check if invoice is in draft status
  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();

  if (fetchError) {
    return { error: "Invoice not found" };
  }

  if (invoice.status !== "draft") {
    return { error: "Only draft invoices can be deleted" };
  }

  // Line items will be deleted automatically via CASCADE
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/billing");
  redirect("/billing");
}
