"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";

type BankOption = {
  id: string;
  name: string;
  swift_code: string | null;
  country: string | null;
  is_active?: boolean | null;
};

type BankAccountActionResult = {
  success: boolean;
  error?: string;
};

interface BankAccountFormProps {
  action: (formData: FormData) => Promise<BankAccountActionResult>;
  banks?: BankOption[];
}

export function BankAccountForm({ action, banks }: BankAccountFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const selectedBank = useMemo(
    () => (banks || []).find((bank) => bank.id === selectedBankId) || null,
    [banks, selectedBankId]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const iban = String(formData.get("iban") || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    const swift = String(formData.get("swift") || "").trim().toUpperCase();

    formData.set("iban", iban);
    formData.set("swift", swift);

    startTransition(async () => {
      try {
        const result = await action(formData);

        if (!result.success) {
          setError(result.error || "An unexpected error occurred");
          return;
        }

        form.reset();
        setSelectedBankId("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <p>{error}</p>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="bank_id">Bank *</Label>
          <select
            id="bank_id"
            name="bank_id"
            className="input"
            required
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
          >
            <option value="">Select a bank</option>
            {(banks || []).map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account_name">Account Name *</Label>
            <Input
              id="account_name"
              name="account_name"
              placeholder="e.g., Strehe-Prona SHPK - Business Account"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank_name_snapshot">Display Bank Name *</Label>
            <Input
              id="bank_name_snapshot"
              name="bank_name_snapshot"
              defaultValue={selectedBank?.name || ""}
              placeholder="e.g., Raiffeisen Bank Kosovo"
              required
              key={selectedBankId || "empty"}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="iban">IBAN *</Label>
            <Input
              id="iban"
              name="iban"
              placeholder="e.g., XK051270000000000000"
              required
              pattern="^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9]{11,30}$"
              title="Must be a valid IBAN format"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="swift">SWIFT/BIC</Label>
            <Input
              id="swift"
              name="swift"
              defaultValue={selectedBank?.swift_code || ""}
              placeholder="e.g., RBKOXKPR"
              pattern="^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$"
              title="Must be 8 or 11 characters"
              key={`swift-${selectedBankId || "empty"}`}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-2">
            <Checkbox id="is_primary" name="is_primary" />
            <span>Set as primary account</span>
          </label>

          <label className="flex items-center gap-2">
            <Checkbox id="show_on_invoice" name="show_on_invoice" defaultChecked />
            <span>Show on invoice</span>
          </label>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Add Account"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/settings")}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}