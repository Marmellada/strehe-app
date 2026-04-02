"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createInvoiceSchema,
  type CreateInvoiceInput,
} from "@/lib/validations/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { InvoiceStatus } from "@/types/billing";

export async function createInvoice(data: CreateInvoiceInput) {
  const supabase = await createClient();

  try {
    const validatedData = createInvoiceSchema.parse(data);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    const totals = computeInvoiceTotals(validatedData.items);

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_type: validatedData.invoice_type,
        property_id: validatedData.property_id ?? null,
        issue_date: validatedData.issue_date,
        due_date: validatedData.due_date,
        notes: validatedData.notes ?? null,
        user_id: user.id,
        subtotal_cents: Math.round(totals.subtotal * 100),
        vat_amount_cents: Math.round(totals.totalVat * 100),
        total_cents: Math.round(totals.total * 100),
        vat_rate: 18,
        status: "draft",
      })
      .select()
      .single();

    if (invoiceError) {
      return { error: invoiceError.message };
    }

    const lineItems = validatedData.items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: Math.round(item.unit_price * 100),
      total_cents: Math.round(item.quantity * item.unit_price * 100),
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(lineItems);

    if (itemsError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return { error: itemsError.message };
    }

    revalidatePath("/billing");
    redirect(`/billing/${invoice.id}`);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create invoice",
    };
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

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/billing");
  redirect("/billing");
}