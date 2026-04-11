"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createExpenseAction,
  updateExpenseAction,
  type ExpenseActionState,
} from "@/lib/actions/expenses";
import { createClient } from "@/lib/supabase/client";
import { Button, FormField, Input, Textarea } from "@/components/ui";

type CategoryOption = {
  id: string;
  name: string;
};

type VendorOption = {
  id: string;
  name: string;
};

type PropertyOption = {
  id: string;
  name: string | null;
};

type WorkerOption = {
  id: string;
  full_name: string | null;
  role_title: string | null;
};

type Props = {
  categories: CategoryOption[];
  vendors: VendorOption[];
  properties: PropertyOption[];
  mode?: "create" | "edit";
  expenseId?: string;
  initialValues?: {
    expense_date: string;
    amount: string;
    description: string;
    expense_category_id: string;
    worker_id: string;
    vendor_id: string;
    property_id: string;
    notes: string;
  };
};

const initialState: ExpenseActionState = {};
const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function ExpenseForm({
  categories,
  vendors,
  properties,
  mode = "create",
  expenseId,
  initialValues,
}: Props) {
  const action =
    mode === "edit" && expenseId
      ? updateExpenseAction.bind(null, expenseId)
      : createExpenseAction;
  const [state, formAction] = useActionState(action, initialState);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const submitLabel = mode === "edit" ? "Save Expense" : "Create Expense";

  useEffect(() => {
    let isMounted = true;

    async function loadWorkers() {
      const supabase = createClient();
      const { data } = await supabase
        .from("workers")
        .select("id, full_name, role_title")
        .eq("status", "active")
        .order("full_name", { ascending: true });

      if (isMounted) {
        setWorkers((data ?? []) as WorkerOption[]);
      }
    }

    void loadWorkers();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FormField label="Expense date" required>
          <Input
            id="expense_date"
            name="expense_date"
            type="date"
            required
            defaultValue={initialValues?.expense_date ?? ""}
          />
        </FormField>

        <FormField
          label="Amount"
          required
          hint="Use decimal input like 12.50. Stored internally as cents."
        >
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={initialValues?.amount ?? ""}
          />
        </FormField>
      </div>

      <FormField label="Description" required>
        <Input
          id="description"
          name="description"
          required
          defaultValue={initialValues?.description ?? ""}
        />
      </FormField>

      <div className="grid gap-6 md:grid-cols-3">
        <FormField label="Worker">
          <select
            id="worker_id"
            name="worker_id"
            defaultValue={initialValues?.worker_id ?? ""}
            className={nativeSelectClassName}
          >
            <option value="">No worker</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name || worker.id}
                {worker.role_title ? ` - ${worker.role_title}` : ""}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Category" required>
          <select
            id="expense_category_id"
            name="expense_category_id"
            required
            defaultValue={initialValues?.expense_category_id ?? ""}
            className={nativeSelectClassName}
          >
            <option value="" disabled>
              Select category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Vendor">
          <select
            id="vendor_id"
            name="vendor_id"
            defaultValue={initialValues?.vendor_id ?? ""}
            className={nativeSelectClassName}
          >
            <option value="">No vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Property">
          <select
            id="property_id"
            name="property_id"
            defaultValue={initialValues?.property_id ?? ""}
            className={nativeSelectClassName}
          >
            <option value="">No property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name ?? property.id}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Notes">
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initialValues?.notes ?? ""}
        />
      </FormField>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
