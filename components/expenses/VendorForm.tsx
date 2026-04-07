"use client";

import { useActionState } from "react";
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

export function VendorForm({ mode, initialValues }: Props) {
  const action = mode === "create" ? createVendorAction : updateVendorAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && <input type="hidden" name="id" value={initialValues?.id ?? ""} />}

      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium">
          Vendor name
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
        <label htmlFor="contact_person" className="block text-sm font-medium">
          Contact person
        </label>
        <input
          id="contact_person"
          name="contact_person"
          defaultValue={initialValues?.contact_person ?? ""}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues?.email ?? ""}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="block text-sm font-medium">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={initialValues?.phone ?? ""}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="address" className="block text-sm font-medium">
          Address
        </label>
        <textarea
          id="address"
          name="address"
          defaultValue={initialValues?.address ?? ""}
          rows={3}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={initialValues?.notes ?? ""}
          rows={4}
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

      <SubmitButton label={mode === "create" ? "Create vendor" : "Save vendor"} />
    </form>
  );
}