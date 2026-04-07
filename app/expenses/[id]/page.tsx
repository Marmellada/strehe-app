import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryStatusBadge } from "@/components/expenses/ExpenseCategoryStatusBadge";

type Props = {
  params: Promise<{ id: string }>;
};

function formatCurrencyFromCents(amountCents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

export default async function ExpenseDetailPage({ params }: Props) {
  await requireRole(["admin", "office"]);

  const { id } = await params;
  const supabase = await createClient();

  const { data: expense, error } = await supabase
    .from("expenses")
    .select(`
      id,
      expense_date,
      amount_cents,
      description,
      notes,
      created_at,
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
        name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !expense) {
    notFound();
  }

  const category = Array.isArray(expense.expense_categories)
    ? expense.expense_categories[0]
    : expense.expense_categories;

  const vendor = Array.isArray(expense.vendors) ? expense.vendors[0] : expense.vendors;
  const property = Array.isArray(expense.properties) ? expense.properties[0] : expense.properties;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href="/expenses" className="text-sm text-muted-foreground hover:underline">
          ← Back to expenses
        </Link>
        <h1 className="text-2xl font-semibold">Expense Detail</h1>
        <p className="text-sm text-muted-foreground">Read-only view for the expense record.</p>
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Expense ID</div>
              <div className="font-mono text-sm">{expense.id}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="text-2xl font-semibold">{formatCurrencyFromCents(expense.amount_cents)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Expense date</div>
              <div className="font-medium">{expense.expense_date}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Description</div>
              <div className="font-medium">{expense.description}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Category</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium">{category?.name ?? "—"}</span>
                {category ? <ExpenseCategoryStatusBadge isActive={category.is_active} /> : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Vendor</div>
              <div className="font-medium">
                {vendor?.name ?? "—"}
                {vendor && !vendor.is_active ? " (inactive)" : ""}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Property</div>
              <div className="font-medium">{property?.name ?? "—"}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Created at</div>
              <div className="font-medium">{new Date(expense.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">Notes</div>
          <div className="mt-1 whitespace-pre-wrap">{expense.notes || "—"}</div>
        </div>
      </div>
    </div>
  );
}