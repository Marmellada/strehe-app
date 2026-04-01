import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/billing/InvoiceForm";
import { redirect } from "next/navigation";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all required data
  const [
    { data: properties },
    { data: units },
    { data: tenants },
    { data: clients },
    { data: banks },
  ] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("units").select("*").order("unit_number"),
    supabase.from("tenants").select("*").order("last_name"),
    supabase.from("clients").select("*").order("name"),
    supabase.from("banks").select("*").order("bank_name"),
  ]);

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Invoice</h1>
        <p className="text-gray-600 mt-2">
          Fill out the details below to generate a new invoice.
        </p>
      </div>

      <InvoiceForm
        properties={properties || []}
        units={units || []}
        tenants={tenants || []}
        clients={clients || []}
        banks={banks || []}
      />
    </div>
  );
}
