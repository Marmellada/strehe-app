import { createClient } from "@/lib/supabase/server";

export type BillingSnapshotPayload = {
  client_name_snapshot: string | null;
  client_email_snapshot: string | null;
  client_phone_snapshot: string | null;
  client_address_snapshot: string | null;
  property_label_snapshot: string | null;
  property_address_snapshot: string | null;
  company_name_snapshot: string | null;
  company_address_snapshot: string | null;
  company_email_snapshot: string | null;
  company_phone_snapshot: string | null;
  company_vat_number_snapshot: string | null;
  company_business_number_snapshot: string | null;
  currency_snapshot: string | null;
  bank_accounts_snapshot: Array<{
    id: string;
    account_name: string | null;
    bank_name: string | null;
    iban: string;
    swift: string | null;
    is_primary: boolean;
  }>;
};

function compactAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function selectSnapshotBankAccounts(
  accounts: BillingSnapshotPayload["bank_accounts_snapshot"]
) {
  if (!accounts.length) return [];
  const primary = accounts.find((account) => account.is_primary);
  if (primary) return [primary];
  return accounts;
}

export async function resolveBillingSnapshot({
  clientId,
  propertyId,
}: {
  clientId: string | null | undefined;
  propertyId: string | null | undefined;
}): Promise<BillingSnapshotPayload> {
  const supabase = await createClient();

  const [
    { data: client },
    { data: property },
    { data: settings },
    { data: bankAccounts },
  ] = await Promise.all([
    clientId
      ? supabase
          .from("clients")
          .select(
            "id, full_name, company_name, email, phone, address_line_1, address_line_2, city, postal_code, country"
          )
          .eq("id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    propertyId
      ? supabase
          .from("properties")
          .select(
            "id, title, property_code, address_line_1, address_line_2, city, postal_code, country"
          )
          .eq("id", propertyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("company_settings")
      .select(
        "company_name, legal_name, email, phone, address, city, country, vat_enabled, vat_number, business_number, currency"
      )
      .limit(1)
      .maybeSingle(),
    supabase
      .from("company_bank_accounts")
      .select(
        `
        id,
        account_name,
        bank_name_snapshot,
        iban,
        swift,
        is_primary,
        is_active,
        show_on_invoice,
        banks (
          id,
          name,
          swift_code
        )
      `
      )
      .eq("is_active", true)
      .eq("show_on_invoice", true),
  ]);

  const clientName = client
    ? client.company_name || client.full_name || null
    : null;
  const clientAddress = client
    ? compactAddress([
        client.address_line_1,
        client.address_line_2,
        client.city,
        client.postal_code,
        client.country,
      ]) || null
    : null;

  const propertyLabel = property
    ? property.property_code
      ? `${property.property_code} - ${property.title || ""}`.trim()
      : property.title || null
    : null;
  const propertyAddress = property
    ? compactAddress([
        property.address_line_1,
        property.address_line_2,
        property.city,
        property.postal_code,
        property.country,
      ]) || null
    : null;

  const companyName = settings
    ? settings.legal_name || settings.company_name || null
    : null;
  const companyAddress = settings
    ? compactAddress([settings.address, settings.city, settings.country]) || null
    : null;

  const mappedBankAccounts = (bankAccounts || []).map((account) => {
    const bank = firstRelation(account.banks);

    return {
      id: account.id,
      account_name: account.account_name ?? null,
      bank_name: account.bank_name_snapshot ?? bank?.name ?? null,
      iban: account.iban,
      swift: account.swift ?? bank?.swift_code ?? null,
      is_primary: !!account.is_primary,
    };
  });

  return {
    client_name_snapshot: clientName,
    client_email_snapshot: client?.email ?? null,
    client_phone_snapshot: client?.phone ?? null,
    client_address_snapshot: clientAddress,
    property_label_snapshot: propertyLabel,
    property_address_snapshot: propertyAddress,
    company_name_snapshot: companyName,
    company_address_snapshot: companyAddress,
    company_email_snapshot: settings?.email ?? null,
    company_phone_snapshot: settings?.phone ?? null,
    company_vat_number_snapshot: settings?.vat_enabled
      ? settings.vat_number ?? null
      : null,
    company_business_number_snapshot: settings?.business_number ?? null,
    currency_snapshot: settings?.currency ?? null,
    bank_accounts_snapshot: selectSnapshotBankAccounts(mappedBankAccounts),
  };
}

export async function refreshBillingSnapshot(invoiceId: string) {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, client_id, property_id")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    throw new Error(error?.message || "Billing document not found.");
  }

  const snapshot = await resolveBillingSnapshot({
    clientId: invoice.client_id,
    propertyId: invoice.property_id,
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update(snapshot)
    .eq("id", invoiceId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
