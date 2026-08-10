"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  FOUNDING_PACKAGES,
  homeRefreshCount,
  type FoundingPackageKey,
  type TermMonths,
  VALID_TERMS,
} from "@/lib/funnel/definitions";
import { COMMERCIAL_PACKAGE_MAP } from "@/lib/funnel/package-map";

// ── Date convention ───────────────────────────────────────────
// Service period: [start_date, start_date + term_months)
// end_date is the LAST day of service (inclusive).
// 12mo starting 2026-09-01 → end_date 2027-08-31.

function computeEndDate(startDate: string, termMonths: number): string {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + termMonths);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Create Invoice From Offer ──────────────────────────────────

export type CreateInvoiceFromOfferResult =
  | { success: true; invoiceId: string }
  | { success: false; error: string };

export async function createInvoiceFromOfferAction(
  offerId: string
): Promise<CreateInvoiceFromOfferResult> {
  const { authUser } = await requireRole(["admin", "office"]);
  const supabase = await createClient();

  // 1. Read the accepted offer
  const { data: offer, error: offerError } = await supabase
    .from("lead_offers")
    .select("*")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) return { success: false, error: "Offer not found." };
  if (offer.status !== "accepted")
    return { success: false, error: "Only accepted offers can be invoiced." };
  if (!offer.converted_client_id)
    return { success: false, error: "Offer must be converted to a client first." };

  const pkgKey = offer.selected_package as FoundingPackageKey;
  if (!FOUNDING_PACKAGES[pkgKey])
    return { success: false, error: "Unknown package on offer." };

  const termMonths = (offer.selected_term_months ?? 12) as TermMonths;
  if (!VALID_TERMS.includes(termMonths))
    return { success: false, error: "Invalid term on offer." };

  // 2. Prevent duplicate invoices for the same offer
  const { count: existingCount, error: dupError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("source_offer_id", offerId)
    .eq("document_type", "invoice")
    .neq("status", "cancelled");

  if (dupError)
    return { success: false, error: "Failed to check for duplicate invoice." };
  if (existingCount && existingCount > 0)
    return {
      success: false,
      error:
        "An active invoice already exists for this accepted offer. Cancel the existing invoice before creating a new one.",
    };

  const pkg = FOUNDING_PACKAGES[pkgKey];
  const totalCents = offer.monthly_price_cents;
  const termLabel = `${termMonths}-month service term`;
  const hrCount = homeRefreshCount(termMonths);
  const hrNote =
    pkgKey === "arrival_ready"
      ? ` and ${hrCount} Home Refresh service${hrCount > 1 ? "s" : ""} during the term`
      : "";

  const description = `${pkg.label} — ${termLabel} — Includes ${pkg.visits}${hrNote}.`;

  // 3. Create draft invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_type: "standard",
      document_type: "invoice",
      client_id: offer.converted_client_id,
      property_id: offer.converted_property_id ?? null,
      source_offer_id: offerId,
      subscription_id: null,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      notes: `Commercial offer ${offer.offer_number} v${offer.version}`,
      user_id: authUser.id,
      subtotal_cents: totalCents,
      vat_amount_cents: 0,
      total_cents: totalCents,
      vat_rate: 0,
      status: "draft",
      invoice_number: null,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice)
    return { success: false, error: invoiceError?.message || "Failed to create invoice." };

  // 4. Create single line item
  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    description,
    quantity: 1,
    unit_price_cents: totalCents,
    total_cents: totalCents,
  });

  if (itemError) {
    await supabase.from("invoices").delete().eq("id", invoice.id).eq("status", "draft");
    return { success: false, error: itemError.message };
  }

  revalidatePath("/billing");
  revalidatePath("/leads");
  return { success: true, invoiceId: invoice.id };
}

// ── Activate Customer ──────────────────────────────────────────

export type ActivateCustomerResult =
  | {
      success: true;
      subscriptionId: string;
      startDate: string;
      endDate: string;
      homeRefreshAllowance: number;
      packageName: string;
    }
  | { success: false; error: string };

export async function activateCustomerAction(
  offerId: string,
  propertyId: string,
  serviceStartDate: string,
  agreementConfirmed: boolean
): Promise<ActivateCustomerResult> {
  const { authUser } = await requireRole(["admin", "office"]);
  const supabase = await createClient();

  // ── Gate 1: offer must be accepted ───────────────────────────
  const { data: offer, error: offerError } = await supabase
    .from("lead_offers")
    .select("*")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) return { success: false, error: "Offer not found." };
  if (offer.status !== "accepted")
    return { success: false, error: "Offer must be accepted." };

  // ── Gate 2: converted client must exist ──────────────────────
  if (!offer.converted_client_id)
    return { success: false, error: "Offer has no converted client." };

  const clientId = offer.converted_client_id;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, status")
    .eq("id", clientId)
    .single();

  if (clientError || !client)
    return { success: false, error: "Converted client not found." };
  if (client.status !== "active")
    return { success: false, error: "Client is not active." };

  // ── Gate 3: valid property belonging to client ───────────────
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, owner_client_id, status")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property)
    return { success: false, error: "Property not found." };
  if (property.owner_client_id !== clientId)
    return { success: false, error: "Property does not belong to the converted client." };

  // ── Gate 4: matching operational package exists ──────────────
  const pkgKey = offer.selected_package as FoundingPackageKey;
  if (!FOUNDING_PACKAGES[pkgKey])
    return { success: false, error: "Unknown package on offer." };

  const mapping = COMMERCIAL_PACKAGE_MAP[pkgKey];
  if (!mapping)
    return { success: false, error: "No operational package mapping found." };

  const { data: opPackage, error: pkgError } = await supabase
    .from("packages")
    .select("id, name, is_active")
    .eq("id", mapping.packageId)
    .single();

  if (pkgError || !opPackage)
    return { success: false, error: "Operational package not found." };
  if (!opPackage.is_active)
    return { success: false, error: "Operational package is not active." };

  // ── Gate 5: term must be valid ───────────────────────────────
  const termMonths = (offer.selected_term_months ?? 12) as TermMonths;
  if (!VALID_TERMS.includes(termMonths))
    return { success: false, error: "Invalid term on offer." };

  // ── Gate 6: service start date ───────────────────────────────
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceStartDate))
    return { success: false, error: "Invalid service start date." };

  const endDate = computeEndDate(serviceStartDate, termMonths);

  // ── Gate 7: agreement / contract confirmation ────────────────
  if (!agreementConfirmed)
    return {
      success: false,
      error:
        "Customer service agreement must be confirmed before activation. The physical contract, key-custody, and onboarding procedures must be completed.",
    };

  // ── Gate 8: invoice must exist and be paid ───────────────────
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, total_cents, status, document_type")
    .eq("source_offer_id", offerId)
    .eq("document_type", "invoice")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (invError)
    return { success: false, error: "Failed to verify invoice state." };
  if (!invoices || invoices.length === 0)
    return {
      success: false,
      error:
        "No invoice found for this offer. Create and issue an invoice first.",
    };

  const invoice = invoices[0];

  if (invoice.document_type !== "invoice")
    return { success: false, error: "Billing document is not an invoice." };

  if (invoice.status !== "issued" && invoice.status !== "paid")
    return {
      success: false,
      error: `Invoice is ${invoice.status}. It must be issued or paid.`,
    };

  // ── Gate 9: full payment confirmed ───────────────────────────
  const { data: payments, error: payError } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", invoice.id);

  if (payError)
    return { success: false, error: "Failed to verify payment state." };

  const totalPaid = (payments || []).reduce(
    (sum, p) => sum + (p.amount_cents || 0),
    0
  );

  if (totalPaid < offer.monthly_price_cents)
    return {
      success: false,
      error: `Payment incomplete. Paid €${(totalPaid / 100).toFixed(2)} of €${(offer.monthly_price_cents / 100).toFixed(2)}.`,
    };

  // ── Gate 10: no conflicting active subscription ──────────────
  const { count: conflictCount, error: conflictError } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("property_id", propertyId)
    .in("status", ["active", "paused"]);

  if (conflictError)
    return { success: false, error: "Failed to check for existing subscriptions." };
  if (conflictCount && conflictCount > 0)
    return {
      success: false,
      error:
        "An active or paused subscription already exists for this client and property.",
    };

  // ── Gate 11: duplicate activation prevention ─────────────────
  const { count: alreadyCount, error: alreadyError } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("property_id", propertyId)
    .gte("end_date", serviceStartDate);

  if (alreadyError)
    return { success: false, error: "Failed to prevent duplicate activation." };
  if (alreadyCount && alreadyCount > 0)
    return {
      success: false,
      error:
        "A subscription already exists for this client and property covering the requested period.",
    };

  // ── Create subscription ──────────────────────────────────────
  const hrAllowance = homeRefreshCount(termMonths);
  const now = new Date().toISOString();

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      client_id: clientId,
      property_id: propertyId,
      package_id: mapping.packageId,
      start_date: serviceStartDate,
      end_date: endDate,
      status: "active",
      monthly_price: 0,
      home_refresh_allowance: hrAllowance,
      home_refresh_used: 0,
      notes: `Activated from offer ${offer.offer_number} v${offer.version}. ${termMonths}-month term.`,
      package_name_snapshot: opPackage.name,
      physical_contract_confirmed_at: now,
      physical_contract_confirmed_by_user_id: authUser.id,
    })
    .select("id")
    .single();

  if (subError || !subscription)
    return {
      success: false,
      error: subError?.message || "Failed to create subscription.",
    };

  // ── Link invoice to subscription (permanent) ─────────────────
  // subscription_id on invoices is nullable with FK → subscriptions(id).
  // Setting it after activation is the correct semantic use of this column.
  await supabase
    .from("invoices")
    .update({ subscription_id: subscription.id })
    .eq("id", invoice.id);

  revalidatePath("/subscriptions");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/billing");

  return {
    success: true,
    subscriptionId: subscription.id,
    startDate: serviceStartDate,
    endDate,
    homeRefreshAllowance: hrAllowance,
    packageName: opPackage.name,
  };
}
