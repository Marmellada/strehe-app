import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { toggleExpenseCategoryActiveAction } from "@/lib/actions/expense-categories";
import { ExpenseCategoryStatusBadge } from "@/components/expenses/ExpenseCategoryStatusBadge";
import {
  Button,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

export default async function ExpenseCategoriesPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("expense_categories")
    .select("id, name, description, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Categories"
        description="Managed reference data for expense classification. Inactive categories remain visible on old records."
        actions={
          <Button asChild>
            <Link href="/settings/expense-categories/new">New Category</Link>
          </Button>
        }
      />

      <TableShell>
        {categories?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.sort_order}</TableCell>
                    <TableCell>
                      <ExpenseCategoryStatusBadge isActive={category.is_active} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/settings/expense-categories/${category.id}/edit`}>
                            Edit
                          </Link>
                        </Button>

                        <form action={toggleExpenseCategoryActiveAction}>
                          <input type="hidden" name="id" value={category.id} />
                          <input
                            type="hidden"
                            name="next_is_active"
                            value={String(!category.is_active)}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {category.is_active ? "Disable" : "Enable"}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              title="No expense categories found"
              description="Create managed categories so expenses stay clean and consistent."
              action={
                <Button asChild>
                  <Link href="/settings/expense-categories/new">New Category</Link>
                </Button>
              }
            />
          </div>
        )}
      </TableShell>
    </div>
  );
}
