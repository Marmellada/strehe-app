import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryForm } from "@/components/expenses/ExpenseCategoryForm";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";

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
      <PageHeader
        title="Edit Expense Category"
        description="Update category metadata and active or inactive state."
        actions={
          <Button asChild variant="ghost">
            <Link href="/settings/expense-categories">Back to Categories</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <ExpenseCategoryForm mode="edit" initialValues={category} />
        </CardContent>
      </Card>
    </div>
  );
}
