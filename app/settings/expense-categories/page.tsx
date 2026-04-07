import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { toggleExpenseCategoryActiveAction } from "@/lib/actions/expense-categories";
import { ExpenseCategoryStatusBadge } from "@/components/expenses/ExpenseCategoryStatusBadge";

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Expense Categories</h1>
          <p className="text-sm text-muted-foreground">
            Managed reference data for expense classification. Inactive categories remain visible on old records.
          </p>
        </div>

        <Link
          href="/settings/expense-categories/new"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          New category
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Sort</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((category) => (
              <tr key={category.id} className="border-t">
                <td className="px-4 py-3 font-medium">{category.name}</td>
                <td className="px-4 py-3">{category.sort_order}</td>
                <td className="px-4 py-3">
                  <ExpenseCategoryStatusBadge isActive={category.is_active} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{category.description || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/settings/expense-categories/${category.id}/edit`}
                      className="rounded-md border px-3 py-1.5 text-sm"
                    >
                      Edit
                    </Link>

                    <form action={toggleExpenseCategoryActiveAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="next_is_active" value={String(!category.is_active)} />
                      <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">
                        {category.is_active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {!categories?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No expense categories found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}