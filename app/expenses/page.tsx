import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
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
      <PageHeader
        title="Expenses"
        description="Manual operational expense records. Historical records keep their original category reference even if the category is later disabled."
        actions={
          <Button asChild>
            <Link href="/expenses/new">New Expense</Link>
          </Button>
        }
      />

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableRow key={expense.id}>
                  <TableCell>{expense.expense_date}</TableCell>
                  <TableCell>
                    <Link href={`/expenses/${expense.id}`} className="font-medium hover:underline">
                      {expense.description}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {categoryLabel !== "—" ? (
                      <div className="flex items-center gap-2">
                        <span>{categoryLabel}</span>
                        {category ? <ExpenseCategoryStatusBadge isActive={category.is_active} /> : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {vendorLabel}
                    {!expense.vendor_name_snapshot && vendor && !vendor.is_active ? " (inactive)" : ""}
                  </TableCell>
                  <TableCell>{propertyLabel}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrencyFromCents(expense.amount_cents)}
                  </TableCell>
                </TableRow>
              );
            })}

            {!expenses?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8">
                  <EmptyState
                    title="No expenses found"
                    description="Create your first expense record to start tracking operational costs."
                    action={
                      <Button asChild>
                        <Link href="/expenses/new">New Expense</Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
