"use client";

import { useActionState, useEffect, useState } from "react";
import { createExpenseAction, type ExpenseActionState } from "@/lib/actions/expenses";
import { createClient } from "@/lib/supabase/client";

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
};

const initialState: ExpenseActionState = {};

function SubmitButton() {
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      Create expense
    </button>
  );
}

export function ExpenseForm({ categories, vendors, properties }: Props) {
  const [state, formAction] = useActionState(createExpenseAction, initialState);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);

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
        <div className="space-y-2">
          <label htmlFor="expense_date" className="block text-sm font-medium">
            Expense date
          </label>
          <input
            id="expense_date"
            name="expense_date"
            type="date"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="amount" className="block text-sm font-medium">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            className="w-full rounded-md border px-3 py-2"
          />
          <p className="text-xs text-muted-foreground">
            Use decimal input like 12.50. Stored internally as cents.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <input
          id="description"
          name="description"
          required
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="worker_id" className="block text-sm font-medium">
            Worker
          </label>
          <select
            id="worker_id"
            name="worker_id"
            defaultValue=""
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">No worker</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name || worker.id}
                {worker.role_title ? ` - ${worker.role_title}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="expense_category_id" className="block text-sm font-medium">
            Category
          </label>
          <select
            id="expense_category_id"
            name="expense_category_id"
            required
            defaultValue=""
            className="w-full rounded-md border px-3 py-2"
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
        </div>

        <div className="space-y-2">
          <label htmlFor="vendor_id" className="block text-sm font-medium">
            Vendor
          </label>
          <select
            id="vendor_id"
            name="vendor_id"
            defaultValue=""
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">No vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="property_id" className="block text-sm font-medium">
            Property
          </label>
          <select
            id="property_id"
            name="property_id"
            defaultValue=""
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">No property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name ?? property.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
