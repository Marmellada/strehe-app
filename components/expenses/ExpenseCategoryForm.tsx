"use client";

import { useActionState } from "react";
import {
  createExpenseCategoryAction,
  updateExpenseCategoryAction,
  type ExpenseCategoryActionState,
} from "@/lib/actions/expense-categories";

type Props = {
  mode: "create" | "edit";
  initialValues?: {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
  };
};

const initialState: ExpenseCategoryActionState = {};

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function ExpenseCategoryForm({ mode, initialValues }: Props) {
  const action = mode === "create" ? createExpenseCategoryAction : updateExpenseCategoryAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && <input type="hidden" name="id" value={initialValues?.id ?? ""} />}

      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium">
          Category name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={initialValues?.name ?? ""}
          required
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={initialValues?.description ?? ""}
          rows={4}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="sort_order" className="block text-sm font-medium">
          Sort order
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={initialValues?.sort_order ?? 0}
          required
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="is_active" className="block text-sm font-medium">
          Status
        </label>
        <select
          id="is_active"
          name="is_active"
          defaultValue={String(initialValues?.is_active ?? true)}
          className="w-full rounded-md border px-3 py-2"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <SubmitButton label={mode === "create" ? "Create category" : "Save category"} />
    </form>
  );
}