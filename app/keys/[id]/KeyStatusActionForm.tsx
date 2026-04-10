'use client';

import { useFormStatus } from 'react-dom';
import { Button, FormField, Textarea } from "@/components/ui";

type Props = {
  action: (formData: FormData) => Promise<void>;
  keyId: string;
  label: string;
  defaultNote?: string;
  noteLabel?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'primary' | 'danger' | 'warning' | 'ghost';
};

function SubmitButton({ label, variant }: { label: string; variant?: string }) {
  const { pending } = useFormStatus();
  const mappedVariant =
    variant === "danger"
      ? "destructive"
      : variant === "primary"
        ? "default"
        : variant === "warning"
          ? "outline"
          : variant === "ghost"
            ? "ghost"
            : variant === "destructive"
              ? "destructive"
              : variant === "outline"
                ? "outline"
                : "default";

  return (
    <Button type="submit" disabled={pending} variant={mappedVariant}>
      {pending ? 'Processing...' : label}
    </Button>
  );
}

export default function KeyStatusActionForm({
  action,
  keyId,
  label,
  defaultNote = '',
  noteLabel = "Note (optional)",
  description,
  variant = 'default',
}: Props) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="key_id" value={keyId} />

      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}

      <FormField id={`${keyId}-notes`} label={noteLabel}>
        <Textarea
          id={`${keyId}-notes`}
          name="notes"
          defaultValue={defaultNote}
          rows={2}
          placeholder="Add a note..."
        />
      </FormField>

      <SubmitButton label={label} variant={variant} />
    </form>
  );
}
