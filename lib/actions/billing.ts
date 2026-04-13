"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createInvoiceSchema,
  createCreditNoteSchema,
  updateInvoiceSchema,
  type CreateInvoiceInput,
  type CreateCreditNoteInput,
  type UpdateInvoiceInput,
} from "@/lib/validations/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import { requireRole } from "@/lib/auth/require-role";
import {
  refreshBillingSnapshot,
  resolveBillingSnapshot,
} from "@/lib/billing/snapshots";

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";
export type DocumentType = "invoice" | "credit_note";

function getStoredVatRate(items: CreateInvoiceInput["items"]) {
  if (!items.length) return 0;

  const firstRate = items[0].vat_rate;
  const allSame = items.every((item) => item.vat_rate === firstRate);

  return allSame ? firstRate : 0;
}

async function getIssuedCreditNotesTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string
) {
  const { data, error } = await supabase
    .from("invoices")
    .select("total_cents")
    .eq("document_type", "credit_note")
    .eq("original_invoice_id", invoiceId)
    .eq("status", "issued");

  if (error) {
    throw new Error("Failed to validate issued credit notes");
  }

  return (
    data?.reduce(
      (sum: number, row: { total_cents: number | null }) =>
        sum + (row.total_cents || 0),
      0
    ) || 0
  );
}

export async function createInvoice(data: CreateInvoiceInput) {
  const { authUser } = await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const validatedData = createInvoiceSchema.parse(data);

  const totals = computeInvoiceTotals(validatedData.items);
  const snapshot = await resolveBillingSnapshot({
    clientId: validatedData.client_id,
    propertyId: validatedData.property_id ?? null,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_type: validatedData.invoice_type,
      document_type: "invoice",
      original_invoice_id: null,
      client_id: validatedData.client_id,
      property_id: validatedData.property_id ?? null,
      subscription_id: validatedData.subscription_id ?? null,
      issue_date: validatedData.issue_date,
      due_date: validatedData.due_date,
      notes: validatedData.notes ?? null,
      user_id: authUser.id,
      subtotal_cents: Math.round(totals.subtotal * 100),
      vat_amount_cents: Math.round(totals.totalVat * 100),
      total_cents: Math.round(totals.total * 100),
      vat_rate: getStoredVatRate(validatedData.items),
      status: "draft",
      invoice_number: null,
      ...snapshot,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return { error: invoiceError?.message || "Failed to create invoice" };
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
    await supabase
      .from("invoices")
      .delete()
      .eq("id", invoice.id)
      .eq("status", "draft");

    return { error: itemsError.message };
  }

  revalidatePath("/billing");

  return { success: true, invoiceId: invoice.id };
}

export async function createCreditNote(data: CreateCreditNoteInput) {
  const { authUser } = await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const validatedData = createCreditNoteSchema.parse(data);

  const { data: originalInvoice, error: originalError } = await supabase
    .from("invoices")
    .select(`
      id,
      client_id,
      property_id,
      subscription_id,
      status,
      document_type,
      total_cents,
      client_name_snapshot,
      client_email_snapshot,
      client_phone_snapshot,
      client_address_snapshot,
      property_label_snapshot,
      property_address_snapshot,
      company_name_snapshot,
      company_address_snapshot,
      company_email_snapshot,
      company_phone_snapshot,
      company_vat_number_snapshot,
      company_business_number_snapshot,
      currency_snapshot,
      bank_accounts_snapshot
    `)
    .eq("id", validatedData.original_invoice_id)
    .single();

  if (originalError || !originalInvoice) {
    return { error: "Original invoice not found" };
  }

  if (originalInvoice.document_type !== "invoice") {
    return { error: "Credit note can only be created from an invoice" };
  }

  if (!["issued", "paid"].includes(originalInvoice.status)) {
    return { error: "Credit note can only be created for issued or paid invoices" };
  }

  const totals = computeInvoiceTotals(validatedData.items);

  if (totals.total <= 0) {
    return { error: "Credit note total must be greater than zero" };
  }

  const issuedCreditTotal = await getIssuedCreditNotesTotal(
    supabase,
    originalInvoice.id
  );

  if (Math.round(totals.total * 100) + issuedCreditTotal > originalInvoice.total_cents) {
    return { error: "Credit note exceeds original invoice total" };
  }

  const { data: creditNote, error: creditNoteError } = await supabase
    .from("invoices")
    .insert({
      invoice_type: "standard",
      document_type: "credit_note",
      original_invoice_id: originalInvoice.id,
      client_id: originalInvoice.client_id,
      property_id: originalInvoice.property_id,
      subscription_id: originalInvoice.subscription_id,
      issue_date: validatedData.issue_date,
      due_date: validatedData.issue_date,
      notes: validatedData.notes ?? null,
      user_id: authUser.id,
      subtotal_cents: Math.round(totals.subtotal * 100),
      vat_amount_cents: Math.round(totals.totalVat * 100),
      total_cents: Math.round(totals.total * 100),
      vat_rate: getStoredVatRate(validatedData.items),
      status: "draft",
      invoice_number: null,
      client_name_snapshot: originalInvoice.client_name_snapshot,
      client_email_snapshot: originalInvoice.client_email_snapshot,
      client_phone_snapshot: originalInvoice.client_phone_snapshot,
      client_address_snapshot: originalInvoice.client_address_snapshot,
      property_label_snapshot: originalInvoice.property_label_snapshot,
      property_address_snapshot: originalInvoice.property_address_snapshot,
      company_name_snapshot: originalInvoice.company_name_snapshot,
      company_address_snapshot: originalInvoice.company_address_snapshot,
      company_email_snapshot: originalInvoice.company_email_snapshot,
      company_phone_snapshot: originalInvoice.company_phone_snapshot,
      company_vat_number_snapshot: originalInvoice.company_vat_number_snapshot,
      company_business_number_snapshot: originalInvoice.company_business_number_snapshot,
      currency_snapshot: originalInvoice.currency_snapshot,
      bank_accounts_snapshot: originalInvoice.bank_accounts_snapshot,
    })
    .select("id")
    .single();

  if (creditNoteError || !creditNote) {
    return { error: creditNoteError?.message || "Failed to create credit note" };
  }

  const lineItems = validatedData.items.map((item) => ({
    invoice_id: creditNote.id,
    description: item.description,
    quantity: item.quantity,
    unit_price_cents: Math.round(item.unit_price * 100),
    total_cents: Math.round(item.quantity * item.unit_price * 100),
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(lineItems);

  if (itemsError) {
    await supabase
      .from("invoices")
      .delete()
      .eq("id", creditNote.id)
      .eq("status", "draft");

    return { error: itemsError.message };
  }

  revalidatePath("/billing");
  revalidatePath(`/billing/${originalInvoice.id}`);

  return { success: true, invoiceId: creditNote.id };
}

export async function updateInvoice(data: UpdateInvoiceInput) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const validatedData = updateInvoiceSchema.parse(data);

  const { data: existingInvoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, status, document_type")
    .eq("id", validatedData.invoice_id)
    .single();

  if (fetchError || !existingInvoice) {
    return { error: "Invoice not found" };
  }

  if (existingInvoice.status !== "draft") {
    return { error: "Only draft documents can be edited" };
  }

  if (existingInvoice.document_type !== "invoice") {
    return { error: "Draft credit notes cannot be edited in this flow" };
  }

  const totals = computeInvoiceTotals(validatedData.items);
  const snapshot = await resolveBillingSnapshot({
    clientId: validatedData.client_id,
    propertyId: validatedData.property_id ?? null,
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      client_id: validatedData.client_id,
      property_id: validatedData.property_id ?? null,
      subscription_id: validatedData.subscription_id ?? null,
      issue_date: validatedData.issue_date,
      due_date: validatedData.due_date,
      notes: validatedData.notes ?? null,
      subtotal_cents: Math.round(totals.subtotal * 100),
      vat_amount_cents: Math.round(totals.totalVat * 100),
      total_cents: Math.round(totals.total * 100),
      vat_rate: getStoredVatRate(validatedData.items),
      ...snapshot,
    })
    .eq("id", validatedData.invoice_id)
    .eq("status", "draft")
    .eq("document_type", "invoice");

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: deleteItemsError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", validatedData.invoice_id);

  if (deleteItemsError) {
    return { error: deleteItemsError.message };
  }

  const lineItems = validatedData.items.map((item) => ({
    invoice_id: validatedData.invoice_id,
    description: item.description,
    quantity: item.quantity,
    unit_price_cents: Math.round(item.unit_price * 100),
    total_cents: Math.round(item.quantity * item.unit_price * 100),
  }));

  const { error: insertItemsError } = await supabase
    .from("invoice_items")
    .insert(lineItems);

  if (insertItemsError) {
    return { error: insertItemsError.message };
  }

  revalidatePath("/billing");
  revalidatePath(`/billing/${validatedData.invoice_id}`);
  revalidatePath(`/billing/${validatedData.invoice_id}/edit`);

  return { success: true, invoiceId: validatedData.invoice_id };
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, status, invoice_number, document_type")
    .eq("id", invoiceId)
    .single();

  if (fetchError || !invoice) {
    return { error: "Document not found" };
  }

  const currentStatus = invoice.status as InvoiceStatus;

  if (currentStatus === "draft" && status === "issued") {
    try {
      await refreshBillingSnapshot(invoiceId);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh billing snapshot",
      };
    }

    const { data, error } = await supabase.rpc("issue_billing_document_with_number", {
      p_invoice_id: invoiceId,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/billing");
    revalidatePath(`/billing/${invoiceId}`);

    return { success: true, invoiceNumber: data as string };
  }

  if (
    invoice.document_type === "invoice" &&
    currentStatus === "issued" &&
    status === "paid"
  ) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoiceId)
      .eq("status", "issued")
      .eq("document_type", "invoice")
      .not("invoice_number", "is", null);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/billing");
    revalidatePath(`/billing/${invoiceId}`);

    return { success: true };
  }

  return { error: `Cannot change document from ${currentStatus} to ${status}` };
}

export async function deleteInvoice(invoiceId: string) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();

  if (fetchError || !invoice) {
    return { error: "Document not found" };
  }

  if (invoice.status !== "draft") {
    return { error: "Only draft documents can be deleted" };
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("status", "draft");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/billing");
  redirect("/billing");
}

export async function recordPayment(formData: FormData) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const invoice_id = String(formData.get("invoice_id") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const payment_method = String(formData.get("payment_method") || "").trim();
  const company_account_id = String(formData.get("company_account_id") || "").trim();
  const reference_number = String(formData.get("reference_number") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!invoice_id) {
    throw new Error("Missing invoice id");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  if (!payment_method) {
    throw new Error("Payment method is required");
  }

  if (!company_account_id) {
    throw new Error("Receiving account is required");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total_cents, status, invoice_number, document_type")
    .eq("id", invoice_id)
    .single();

  if (invoiceError || !invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.document_type !== "invoice") {
    throw new Error("Payments can only be recorded for invoices");
  }

  if (invoice.status !== "issued") {
    throw new Error("Payments can only be recorded for issued invoices");
  }

  if (!invoice.invoice_number) {
    throw new Error("Issued invoice is missing invoice number");
  }

  const { data: existingPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", invoice_id);

  if (paymentsError) {
    throw new Error("Failed to validate existing payments");
  }

  const alreadyPaid =
    existingPayments?.reduce(
      (sum: number, payment: { amount_cents: number | null }) =>
        sum + (payment.amount_cents || 0),
      0
    ) || 0;

  const creditedTotal = await getIssuedCreditNotesTotal(supabase, invoice_id);
  const amount_cents = Math.round(amount * 100);
  const remainingBalance = Math.max(
    0,
    (invoice.total_cents || 0) - alreadyPaid - creditedTotal
  );

  if (remainingBalance <= 0) {
    throw new Error("Invoice has no remaining balance after payments and credit notes");
  }

  if (amount_cents > remainingBalance) {
    throw new Error(
      `Payment exceeds remaining balance. Remaining balance is €${(
        remainingBalance / 100
      ).toFixed(2)}`
    );
  }

  const { data: companyAccount, error: companyAccountError } = await supabase
    .from("company_bank_accounts")
    .select("id, account_type, bank_id, is_active")
    .eq("id", company_account_id)
    .single();

  if (companyAccountError || !companyAccount) {
    throw new Error("Receiving account not found");
  }

  if (!companyAccount.is_active) {
    throw new Error("Receiving account is inactive");
  }

  if (payment_method === "cash" && companyAccount.account_type !== "cash") {
    throw new Error("Cash payments must be recorded into a cash account");
  }

  if (payment_method === "bank_transfer" && companyAccount.account_type !== "bank") {
    throw new Error("Bank transfers must be recorded into a bank account");
  }

  const payload = {
    invoice_id,
    amount_cents,
    payment_method,
    payment_date: new Date().toISOString().slice(0, 10),
    company_account_id,
    bank_id: payment_method === "bank_transfer" ? companyAccount.bank_id : null,
    reference_number: reference_number || null,
    notes: notes || null,
  };

  const { error: insertError } = await supabase.from("payments").insert(payload);

  if (insertError) {
    throw new Error(insertError.message || "Failed to create payment");
  }

  const newPaidTotal = alreadyPaid + amount_cents;

  if (newPaidTotal + creditedTotal >= invoice.total_cents) {
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoice_id)
      .eq("status", "issued")
      .eq("invoice_number", invoice.invoice_number)
      .eq("document_type", "invoice");

    if (updateError) {
      throw new Error("Payment saved but failed to update invoice status");
    }
  }

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoice_id}`);
  redirect(`/billing/${invoice_id}`);
}
