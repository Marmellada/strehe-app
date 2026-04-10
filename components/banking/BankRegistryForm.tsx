"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

type BankRegistryActionResult = {
  success: boolean;
  error?: string;
};

type BankRegistryInitialValues = {
  name?: string | null;
  country?: string | null;
  swift_code?: string | null;
};

type BankRegistryFormProps = {
  action: (formData: FormData) => Promise<BankRegistryActionResult>;
  initialValues?: BankRegistryInitialValues;
  submitLabel?: string;
  cancelHref?: string;
  successRedirectHref?: string;
};

export function BankRegistryForm({
  action,
  initialValues,
  submitLabel = "Save Bank",
  cancelHref = "/settings/banking",
  successRedirectHref = "/settings/banking",
}: BankRegistryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set(
      "swift_code",
      String(formData.get("swift_code") || "").trim().toUpperCase()
    );

    startTransition(async () => {
      try {
        const result = await action(formData);

        if (!result.success) {
          setError(result.error || "Unable to save bank.");
          return;
        }

        router.push(successRedirectHref);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save bank.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save bank</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="name"
          label="Bank Name"
          required
          hint="Use the formal licensed bank name."
        >
          <Input
            id="name"
            name="name"
            defaultValue={initialValues?.name || ""}
            placeholder="e.g. Raiffeisen Bank Kosovo J.S.C."
            required
          />
        </FormField>

        <FormField
          id="country"
          label="Country"
          required
          hint="Default country is Kosovo."
        >
          <Input
            id="country"
            name="country"
            defaultValue={initialValues?.country || "Kosovo"}
            placeholder="Kosovo"
            required
          />
        </FormField>
      </div>

      <FormField
        id="swift_code"
        label="SWIFT / BIC"
        hint="Optional. Use the institution's official SWIFT/BIC code."
      >
        <Input
          id="swift_code"
          name="swift_code"
          defaultValue={initialValues?.swift_code || ""}
          placeholder="e.g. RBKOXKPR"
          pattern="^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$"
          title="Must be 8 or 11 characters"
          className="uppercase"
        />
      </FormField>

      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(cancelHref)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
