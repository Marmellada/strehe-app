import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { PageHeader, SectionCard } from "@/components/ui";

type Props = {
  params: Promise<{ id: string }>;
};

function formatAmountFromCents(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

export default async function EditExpensePage({ params }: Props) {
  await requireRole(["admin", "office"]);

  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: expense, error: expenseError },
    { data: categories, error: categoriesError },
    { data: vendors, error: vendorsError },
    { data: properties, error: propertiesError },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, expense_date, amount_cents, description, expense_category_id, category_name_snapshot, worker_id, vendor_id, property_id, notes"
      )
      .eq("id", id)
      .single(),
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

  if (expenseError || !expense) {
    notFound();
  }

  if (categoriesError) throw new Error(categoriesError.message);
  if (vendorsError) throw new Error(vendorsError.message);
  if (propertiesError) throw new Error(propertiesError.message);

  const categoryOptions = [...(categories ?? [])];
  const hasCurrentCategory = categoryOptions.some(
    (category) => category.id === expense.expense_category_id,
  );
  if (!hasCurrentCategory && expense.expense_category_id && expense.category_name_snapshot) {
    categoryOptions.unshift({
      id: expense.expense_category_id,
      name: `${expense.category_name_snapshot} (inactive)`,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Expense"
        description="Correct the recorded expense while keeping the same audit trail and linked references."
        actions={
          <Link href={`/expenses/${expense.id}`}>
            <span className="text-sm text-muted-foreground hover:underline">
              Back to expense
            </span>
          </Link>
        }
      />

      <SectionCard
        title="Expense Details"
        description="Update the financial and operational context for this expense."
      >
        <ExpenseForm
          mode="edit"
          expenseId={expense.id}
          categories={categoryOptions}
          vendors={vendors ?? []}
          properties={(properties ?? []).map((property) => ({
            id: property.id,
            name: property.title ?? "",
          }))}
          initialValues={{
            expense_date: expense.expense_date,
            amount: formatAmountFromCents(expense.amount_cents),
            description: expense.description,
            expense_category_id: expense.expense_category_id,
            worker_id: expense.worker_id ?? "",
            vendor_id: expense.vendor_id ?? "",
            property_id: expense.property_id ?? "",
            notes: expense.notes ?? "",
          }}
        />
      </SectionCard>
    </div>
  );
}
