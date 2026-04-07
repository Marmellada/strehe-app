import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";

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
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  if (categoriesError) throw new Error(categoriesError.message);
  if (vendorsError) throw new Error(vendorsError.message);
  if (propertiesError) throw new Error(propertiesError.message);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href="/expenses" className="text-sm text-muted-foreground hover:underline">
          ← Back to expenses
        </Link>
        <h1 className="text-2xl font-semibold">New Expense</h1>
        <p className="text-sm text-muted-foreground">
          Create a manual expense record. Only active categories are selectable.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <ExpenseForm
          categories={categories ?? []}
          vendors={vendors ?? []}
          properties={properties ?? []}
        />
      </div>
    </div>
  );
}