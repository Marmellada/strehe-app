import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ExpenseCategoryStatusBadge } from "@/components/expenses/ExpenseCategoryStatusBadge";
import {
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

type SearchParams = {
  search?: string;
  category_id?: string;
  vendor_id?: string;
  property_id?: string;
  from?: string;
  to?: string;
};

function formatCurrencyFromCents(amountCents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function getMonthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireRole(["admin", "office"]);

  const params = (await searchParams) || {};
  const search = params.search?.trim() ?? "";
  const categoryId = params.category_id ?? "";
  const vendorId = params.vendor_id ?? "";
  const propertyId = params.property_id ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const supabase = await createClient();

  let expensesQuery = supabase.from("expenses").select(`
      id,
      expense_date,
      amount_cents,
      description,
      expense_category_id,
      vendor_id,
      property_id,
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
    `);

  if (categoryId) {
    expensesQuery = expensesQuery.eq("expense_category_id", categoryId);
  }

  if (vendorId) {
    expensesQuery = expensesQuery.eq("vendor_id", vendorId);
  }

  if (propertyId) {
    expensesQuery = expensesQuery.eq("property_id", propertyId);
  }

  if (from) {
    expensesQuery = expensesQuery.gte("expense_date", from);
  }

  if (to) {
    expensesQuery = expensesQuery.lte("expense_date", to);
  }

  if (search) {
    expensesQuery = expensesQuery.or(
      `description.ilike.%${search}%,category_name_snapshot.ilike.%${search}%,vendor_name_snapshot.ilike.%${search}%,property_code_snapshot.ilike.%${search}%,worker_name_snapshot.ilike.%${search}%`,
    );
  }

  const monthStart = getMonthStartIso();

  const [
    { data: expenses, error },
    { data: categories, error: categoriesError },
    { data: vendors, error: vendorsError },
    { data: properties, error: propertiesError },
    totalCountResult,
    monthSpendResult,
  ] = await Promise.all([
    expensesQuery
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("expense_categories")
      .select("id, name")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("vendors").select("id, name").order("name", { ascending: true }),
    supabase.from("properties").select("id, title").order("title", { ascending: true }),
    supabase.from("expenses").select("id", { count: "exact", head: true }),
    supabase
      .from("expenses")
      .select("amount_cents")
      .gte("expense_date", monthStart),
  ]);

  if (error) throw new Error(error.message);
  if (categoriesError) throw new Error(categoriesError.message);
  if (vendorsError) throw new Error(vendorsError.message);
  if (propertiesError) throw new Error(propertiesError.message);
  if (totalCountResult.error) throw new Error(totalCountResult.error.message);
  if (monthSpendResult.error) throw new Error(monthSpendResult.error.message);

  const hasData = (expenses?.length ?? 0) > 0;
  const filteredSpend = (expenses ?? []).reduce(
    (sum, expense) => sum + expense.amount_cents,
    0,
  );
  const currentMonthSpend = (monthSpendResult.data ?? []).reduce(
    (sum, expense) => sum + (expense.amount_cents ?? 0),
    0,
  );
  const vendorLinkedCount = (expenses ?? []).filter((expense) => Boolean(expense.vendor_id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Manual operational expense records. Historical records keep their saved snapshots even if linked reference data later changes."
        actions={
          <Button asChild>
            <Link href="/expenses/new">New Expense</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Records" value={totalCountResult.count ?? 0} />
        <StatCard title="Filtered Records" value={expenses?.length ?? 0} />
        <StatCard title="Filtered Spend" value={formatCurrencyFromCents(filteredSpend)} />
        <StatCard title="Current Month Spend" value={formatCurrencyFromCents(currentMonthSpend)} />
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <form method="GET" className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              name="search"
              placeholder="Search description, vendor, property, or worker..."
              defaultValue={search}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <select
              id="category_id"
              name="category_id"
              defaultValue={categoryId}
              className={nativeSelectClassName}
            >
              <option value="">All categories</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_id">Vendor</Label>
            <select
              id="vendor_id"
              name="vendor_id"
              defaultValue={vendorId}
              className={nativeSelectClassName}
            >
              <option value="">All vendors</option>
              {(vendors ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property_id">Property</Label>
            <select
              id="property_id"
              name="property_id"
              defaultValue={propertyId}
              className={nativeSelectClassName}
            >
              <option value="">All properties</option>
              {(properties ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title ?? property.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>

          <div className="flex items-end gap-2 md:col-span-6">
            <Button type="submit">Apply Filters</Button>
            <Button asChild variant="ghost">
              <Link href="/expenses">Reset</Link>
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              Vendor-linked in current results: {vendorLinkedCount}
            </div>
          </div>
        </form>
      </div>

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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(expenses ?? []).map((expense) => {
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/expenses/${expense.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/expenses/${expense.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {!hasData ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <EmptyState
                    title="No expenses found"
                    description="Try broadening the filters, or create a new expense to start tracking operational costs."
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
