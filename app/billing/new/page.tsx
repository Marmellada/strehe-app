import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { InvoiceForm } from "@/components/billing/InvoiceForm";
import { PageHeader } from "@/components/ui/PageHeader";

type ClientOption = {
  id: string;
  full_name: string | null;
  company_name: string | null;
};

type SubscriptionOption = {
  id: string;
  client_id: string;
  property_id: string;
  package_id: string;
  property_title: string;
  package_name: string;
  monthly_price: number;
};

type ServiceOption = {
  id: string;
  name: string;
  category: string | null;
  base_price: number;
};

type PromotionCodeOption = {
  id: string;
  code: string;
  assigned_email: string | null;
  status: string | null;
  expires_at: string | null;
  redemption_count: number | null;
  max_redemptions: number | null;
  campaign:
    | {
        id: string;
        name: string | null;
        discount_type: "percent" | "fixed_amount";
        discount_percent: number | string | null;
        discount_amount_cents: number | null;
        applies_to: "package_fee" | "service_lines" | "both";
        active: boolean | null;
        starts_at: string | null;
        ends_at: string | null;
      }
    | {
        id: string;
        name: string | null;
        discount_type: "percent" | "fixed_amount";
        discount_percent: number | string | null;
        discount_amount_cents: number | null;
        applies_to: "package_fee" | "service_lines" | "both";
        active: boolean | null;
        starts_at: string | null;
        ends_at: string | null;
      }[]
    | null;
};

type RelatedProperty = {
  id: string;
  title: string | null;
};

type RelatedPackage = {
  id: string;
  name: string | null;
  monthly_price: number | string | null;
};

type SubscriptionQueryRow = {
  id: string;
  client_id: string;
  property_id: string;
  package_id: string;
  monthly_price: number | string | null;
  property: RelatedProperty | RelatedProperty[] | null;
  package: RelatedPackage | RelatedPackage[] | null;
};

export default async function NewInvoicePage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const [
    { data: clients },
    { data: subscriptionsRaw },
    { data: servicesRaw },
    { data: promotionCodesRaw },
  ] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name")
        .order("full_name"),

      supabase
        .from("subscriptions")
        .select(
          `
          id,
          client_id,
          property_id,
          package_id,
          monthly_price,
          property:properties!subscriptions_property_fk (
            id,
            title
          ),
          package:packages!subscriptions_package_fk (
            id,
            name,
            monthly_price
          )
        `
        )
        .eq("status", "active")
        .order("created_at", { ascending: false }),

      supabase
        .from("services")
        .select("id, name, category, base_price")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("promotion_codes")
        .select(
          `
          id,
          code,
          assigned_email,
          status,
          expires_at,
          redemption_count,
          max_redemptions,
          campaign:promotion_campaigns (
            id,
            name,
            discount_type,
            discount_percent,
            discount_amount_cents,
            applies_to,
            active,
            starts_at,
            ends_at
          )
        `
        )
        .in("status", ["issued", "sent"])
        .order("created_at", { ascending: false }),
    ]);

  const subscriptionOptions: SubscriptionOption[] = (subscriptionsRaw || []).map(
    (row: SubscriptionQueryRow) => {
      const property = Array.isArray(row.property) ? row.property[0] : row.property;
      const pkg = Array.isArray(row.package) ? row.package[0] : row.package;

      return {
        id: row.id,
        client_id: row.client_id,
        property_id: row.property_id,
        package_id: row.package_id,
        property_title: property?.title || "Untitled property",
        package_name: pkg?.name || "Unnamed package",
        monthly_price: Number(
          row.monthly_price ?? pkg?.monthly_price ?? 0
        ),
      };
    }
  );

  const serviceOptions: ServiceOption[] = (servicesRaw || []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    base_price: Number(row.base_price || 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Invoice"
        description="Create a new invoice for a client"
      />

      <InvoiceForm
        clients={(clients || []) as ClientOption[]}
        subscriptions={subscriptionOptions}
        services={serviceOptions}
        promotionCodes={(promotionCodesRaw || []) as PromotionCodeOption[]}
      />
    </div>
  );
}
