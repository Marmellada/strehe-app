import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryForm } from "@/components/expenses/ExpenseCategoryForm";

export default async function NewExpenseCategoryPage() {
  await requireRole(["admin", "office"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/settings/expense-categories" className="text-sm text-muted-foreground hover:underline">
          ← Back to expense categories
        </Link>
        <h1 className="text-2xl font-semibold">New Expense Category</h1>
        <p className="text-sm text-muted-foreground">
          Create a managed category for expense classification.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <ExpenseCategoryForm mode="create" />
      </div>
    </div>
  );
}