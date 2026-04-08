'use client';

import { useFormStatus } from 'react-dom';

type User = {
  id: string;
  full_name: string | null;
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

  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';
  const styles: Record<string, string> = {
    default:     'bg-primary text-primary-foreground hover:bg-primary/90',
    primary:     'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    danger:      'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    warning:     'bg-amber-500/90 text-white hover:bg-amber-500',
    outline:     'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost:       'hover:bg-accent hover:text-accent-foreground',
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
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Assign To
          </label>
          <select
            name="userId"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">Select a user...</option>
            {users.map((u: User) => (
              <option key={u.id} value={u.id}>
                {u.full_name || "Unnamed User"}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-muted-foreground">
          Note (optional)
        </label>
        <textarea
          name="note"
          defaultValue={defaultNote}
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          placeholder="Add a note..."
        />
      </div>

      <SubmitButton label={label} variant={variant} />
    </form>
  );
}
