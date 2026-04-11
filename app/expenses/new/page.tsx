import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { Button, PageHeader, SectionCard } from "@/components/ui";

export default async function NewExpensePage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const [
    { data: categories, error: categoriesError },
    { data: vendors, error: vendorsError },
    { data: properties, error: propertiesError },
  ] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("properties")
      .select("id, title")
      .order("title", { ascending: true }),
  ]);

  if (categoriesError) throw new Error(categoriesError.message);
  if (vendorsError) throw new Error(vendorsError.message);
  if (propertiesError) throw new Error(propertiesError.message);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="New Expense"
        description="Create a manual expense record. Only active categories are selectable."
        actions={
          <Button asChild variant="ghost">
            <Link href="/expenses">Back to expenses</Link>
          </Button>
        }
      />

      <SectionCard
        title="Expense Details"
        description="Capture the amount, category, and operational context for the expense."
      >
        <ExpenseForm
          categories={categories ?? []}
          vendors={vendors ?? []}
          properties={(properties ?? []).map((property) => ({
            id: property.id,
            name: property.title ?? "",
          }))}
        />
      </SectionCard>
    </div>
  );
}
