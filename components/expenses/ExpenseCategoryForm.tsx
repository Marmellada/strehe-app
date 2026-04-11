"use client";

import { useActionState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  FormField,
  Input,
  Textarea,
} from "@/components/ui";
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
const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function ExpenseCategoryForm({ mode, initialValues }: Props) {
  const action = mode === "create" ? createExpenseCategoryAction : updateExpenseCategoryAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && <input type="hidden" name="id" value={initialValues?.id ?? ""} />}

      <FormField label="Category Name" required>
        <Input
          id="name"
          name="name"
          defaultValue={initialValues?.name ?? ""}
          required
          placeholder="Cleaning supplies"
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          id="description"
          name="description"
          defaultValue={initialValues?.description ?? ""}
          rows={4}
          placeholder="Used for one-off cleaning, materials, or supply purchases."
        />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Sort Order" required hint="Lower numbers appear first.">
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            min={0}
            defaultValue={initialValues?.sort_order ?? 0}
            required
          />
        </FormField>

        <FormField label="Status">
          <select
            id="is_active"
            name="is_active"
            defaultValue={String(initialValues?.is_active ?? true)}
            className={nativeSelectClassName}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </FormField>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit">
          {mode === "create" ? "Create Category" : "Save Category"}
        </Button>
      </div>
    </form>
  );
}
