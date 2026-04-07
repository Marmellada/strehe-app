import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryForm } from "@/components/expenses/ExpenseCategoryForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditExpenseCategoryPage({ params }: Props) {
  await requireRole(["admin", "office"]);

  const { id } = await params;
  const supabase = await createClient();

  const { data: category, error } = await supabase
    .from("expense_categories")
    .select("id, name, description, sort_order, is_active")
    .eq("id", id)
    .single();

  if (error || !category) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/settings/expense-categories"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to expense categories
        </Link>

        <h1 className="text-2xl font-semibold">Edit Expense Category</h1>
        <p className="text-sm text-muted-foreground">
          Update category metadata and active/inactive state.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <ExpenseCategoryForm mode="edit" initialValues={category} />
      </div>
    </div>
  );
}