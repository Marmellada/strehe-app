import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/billing/InvoiceForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [{ data: properties }, { data: clients }, { data: bankAccounts }] =
    await Promise.all([
      supabase.from("properties").select("id, title").order("title"),

      supabase
        .from("clients")
        .select("id, full_name, company_name")
        .order("full_name"),

      supabase
        .from("company_bank_accounts")
        .select(`
          id,
          bank_id,
          iban,
          account_name,
          is_primary,
          is_active,
          banks (
            id,
            name,
            swift_code
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Invoice"
        description="Create a new invoice for a client"
      />

      <InvoiceForm
        properties={properties || []}
        clients={clients || []}
        bankAccounts={bankAccounts || []}
      />
    </div>
  );
}