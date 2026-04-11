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
import { createVendorAction, updateVendorAction, type VendorActionState } from "@/lib/actions/vendors";

type Props = {
  mode: "create" | "edit";
  initialValues?: {
    id: string;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    is_active: boolean;
  };
};

const initialState: VendorActionState = {};
const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function VendorForm({ mode, initialValues }: Props) {
  const action = mode === "create" ? createVendorAction : updateVendorAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && <input type="hidden" name="id" value={initialValues?.id ?? ""} />}

      <FormField label="Vendor Name" required>
        <Input
          id="name"
          name="name"
          defaultValue={initialValues?.name ?? ""}
          required
          placeholder="Pro Electric LLC"
        />
      </FormField>

      <FormField label="Contact Person">
        <Input
          id="contact_person"
          name="contact_person"
          defaultValue={initialValues?.contact_person ?? ""}
          placeholder="Arben K."
        />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues?.email ?? ""}
            placeholder="vendor@example.com"
          />
        </FormField>

        <FormField label="Phone">
          <Input
            id="phone"
            name="phone"
            defaultValue={initialValues?.phone ?? ""}
            placeholder="+383 xx xxx xxx"
          />
        </FormField>
      </div>

      <FormField label="Address">
        <Textarea
          id="address"
          name="address"
          defaultValue={initialValues?.address ?? ""}
          rows={3}
          placeholder="Street, city, and any useful location detail"
        />
      </FormField>

      <FormField label="Notes">
        <Textarea
          id="notes"
          name="notes"
          defaultValue={initialValues?.notes ?? ""}
          rows={4}
          placeholder="Optional payment, service, or relationship notes"
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

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit">
          {mode === "create" ? "Create Vendor" : "Save Vendor"}
        </Button>
      </div>
    </form>
  );
}
