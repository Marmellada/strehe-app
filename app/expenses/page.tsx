import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryStatusBadge } from "@/components/expenses/ExpenseCategoryStatusBadge";

function formatCurrencyFromCents(amountCents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

export default async function ExpensesPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select(`
      id,
      expense_date,
      amount_cents,
      description,
      category_name_snapshot,
      vendor_name_snapshot,
      property_code_snapshot,
      worker_name_snapshot,
      vendors (
        id,
        name,
        is_active
      ),
      expense_categories (
        id,
        name,
        is_active
      ),
      properties (
        id,
        property_code,
        title
      )
    `)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Manual operational expense records. Historical records keep their original category reference even if the category is later disabled.
          </p>
        </div>

        <Link
          href="/expenses/new"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          New expense
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Vendor</th>
              <th className="px-4 py-3 text-left font-medium">Property</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses?.map((expense) => {
              const category = Array.isArray(expense.expense_categories)
                ? expense.expense_categories[0]
                : expense.expense_categories;

              const vendor = Array.isArray(expense.vendors) ? expense.vendors[0] : expense.vendors;
              const property = Array.isArray(expense.properties) ? expense.properties[0] : expense.properties;

              const categoryLabel = expense.category_name_snapshot || category?.name || "—";
              const vendorLabel = expense.vendor_name_snapshot || vendor?.name || "—";
              const propertyLabel =
                expense.property_code_snapshot || property?.property_code || property?.title || "—";

              return (
                <tr key={expense.id} className="border-t">
                  <td className="px-4 py-3">{expense.expense_date}</td>
                  <td className="px-4 py-3">
                    <Link href={`/expenses/${expense.id}`} className="font-medium hover:underline">
                      {expense.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {categoryLabel !== "—" ? (
                      <div className="flex items-center gap-2">
                        <span>{categoryLabel}</span>
                        {category ? <ExpenseCategoryStatusBadge isActive={category.is_active} /> : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {vendorLabel}
                    {!expense.vendor_name_snapshot && vendor && !vendor.is_active ? " (inactive)" : ""}
                  </td>
                  <td className="px-4 py-3">{propertyLabel}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrencyFromCents(expense.amount_cents)}
                  </td>
                </tr>
              );
            })}

            {!expenses?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No expenses found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
