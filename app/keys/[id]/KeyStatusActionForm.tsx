'use client';

import { useFormStatus } from 'react-dom';

type User = {
  id: string;
  full_name: string;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  keyId: string;
  label: string;
  defaultNote?: string;
  users?: User[];
  variant?: 'default' | 'destructive' | 'outline' | 'primary' | 'danger' | 'warning' | 'ghost';
};

function SubmitButton({ label, variant }: { label: string; variant?: string }) {
  const { pending } = useFormStatus();

  const base = 'px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50';
  const styles: Record<string, string> = {
    default:     'bg-gray-600 text-white hover:bg-gray-700',
    primary:     'bg-blue-600 text-white hover:bg-blue-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    danger:      'bg-red-600 text-white hover:bg-red-700',
    warning:     'bg-yellow-500 text-white hover:bg-yellow-600',
    outline:     'border border-gray-300 text-gray-700 hover:bg-gray-100',
    ghost:       'text-gray-600 hover:bg-gray-100',
  };

  const style = styles[variant ?? 'default'] ?? styles.default;

  return (
    <button type="submit" disabled={pending} className={`${base} ${style}`}>
      {pending ? 'Processing...' : label}
    </button>
  );
}

export default function KeyStatusActionForm({
  action,
  keyId,
  label,
  defaultNote = '',
  users = [],
  variant = 'default',
}: Props) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="keyId" value={keyId} />

      {users.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign To
          </label>
          <select
            name="userId"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Select a user...</option>
            {users.map((u: User) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note (optional)
        </label>
        <textarea
          name="note"
          defaultValue={defaultNote}
          rows={2}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
          placeholder="Add a note..."
        />
      </div>

      <SubmitButton label={label} variant={variant} />
    </form>
  );
}
