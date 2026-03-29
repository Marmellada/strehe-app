"use client";

import { useFormStatus } from "react-dom";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function KeyStatusActionForm({
  action,
  keyId,
  label,
  defaultNote,
}: {
  action: (formData: FormData) => void | Promise<void>;
  keyId: string;
  label: string;
  defaultNote: string;
}) {
  return (
    <form action={action} className="space-y-3 rounded-xl border p-4">
      <input type="hidden" name="key_id" value={keyId} />

      <div>
        <label className="mb-1 block text-sm font-medium">Performed by</label>
        <input
          name="user_name"
          required
          placeholder="Enter your name"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          defaultValue={defaultNote}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <SubmitButton label={label} />
    </form>
  );
}