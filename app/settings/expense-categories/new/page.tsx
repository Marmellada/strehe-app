import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryForm } from "@/components/expenses/ExpenseCategoryForm";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";

export default async function NewExpenseCategoryPage() {
  await requireRole(["admin", "office"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New Expense Category"
        description="Create a managed category for expense classification."
        actions={
          <Button asChild variant="ghost">
            <Link href="/settings/expense-categories">Back to Categories</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <ExpenseCategoryForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
