"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import type { BankAccount } from "@/types/banking";

interface BankAccountFormProps {
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  initialData?: BankAccount;
}

export function BankAccountForm({
  action,
  initialData,
}: BankAccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await action(formData);
      if (result.success) {
        router.push("/settings/banking");
        router.refresh();
      } else {
        setError(result.error || "An unexpected error occurred");
      }
    });
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <p>{error}</p>
          </Alert>
        )}

        {initialData && (
          <input type="hidden" name="bank_id" value={initialData.bank_id} />
        )}

        <div className="space-y-2">
          <Label htmlFor="bank_name">Bank Name *</Label>
          <Input
            id="bank_name"
            name="bank_name"
            defaultValue={initialData?.bank_name}
            placeholder="e.g., Raiffeisen Bank Kosovo"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input
            id="account_number"
            name="account_number"
            defaultValue={initialData?.account_number || ""}
            placeholder="e.g., 1234567890"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="iban">IBAN *</Label>
          <Input
            id="iban"
            name="iban"
            defaultValue={initialData?.iban}
            placeholder="e.g., XK05 1270 0000 0000 0000 00"
            required
            pattern="^XK[0-9]{2}[0-9]{4}[0-9]{10}[0-9]{2}$|^XK[0-9]{2}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{2}$"
            title="Must be a valid Kosovo IBAN (XK followed by 18 digits)"
          />
          <p className="text-sm text-muted-foreground">
            Format: XK05 1270 0000 0000 0000 00
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="swift_bic">SWIFT/BIC Code</Label>
          <Input
            id="swift_bic"
            name="swift_bic"
            defaultValue={initialData?.swift_bic || ""}
            placeholder="e.g., RBKOXKPR"
            pattern="^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$"
            title="Must be 8 or 11 characters (e.g., RBKOXKPR)"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_primary"
            name="is_primary"
            defaultChecked={initialData?.is_primary ?? false}
          />
          <Label htmlFor="is_primary" className="cursor-pointer">
            Set as primary account
          </Label>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : initialData ? "Update Account" : "Add Account"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}