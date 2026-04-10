"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BankIdentifierType, BankRegistryBank, CardScheme } from "@/types/banking";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

function normalizeRuleValue(value: string, identifierType: BankIdentifierType) {
  if (identifierType === "card_bin") {
    return value.replace(/\D+/g, "");
  }

  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type BankIdentifierActionResult = {
  success: boolean;
  error?: string;
};

type BankIdentifierInitialValues = {
  bank_id?: string | null;
  identifier_type?: BankIdentifierType | null;
  value?: string | null;
  value_end?: string | null;
  scheme?: string | null;
  country_code?: string | null;
  priority?: number | null;
  is_active?: boolean | null;
  source?: string | null;
  notes?: string | null;
};

type BankIdentifierRuleFormProps = {
  action: (formData: FormData) => Promise<BankIdentifierActionResult>;
  banks: BankRegistryBank[];
  initialValues?: BankIdentifierInitialValues;
  submitLabel?: string;
  cancelHref?: string;
  successRedirectHref?: string;
};

export function BankIdentifierRuleForm({
  action,
  banks,
  initialValues,
  submitLabel = "Save Rule",
  cancelHref = "/settings/banking/detection",
  successRedirectHref = "/settings/banking/detection",
}: BankIdentifierRuleFormProps) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [identifierType, setIdentifierType] = useState<BankIdentifierType>(
    initialValues?.identifier_type || "iban_prefix"
  );
  const [value, setValue] = useState<string>(initialValues?.value || "");
  const [valueEnd, setValueEnd] = useState<string>(initialValues?.value_end || "");
  const [scheme, setScheme] = useState<string>(initialValues?.scheme || "");

  const valueHint = useMemo(() => {
    if (identifierType === "iban_prefix") {
      return "Use the verified opening part of the IBAN, for example XK0517.";
    }

    if (identifierType === "account_prefix") {
      return "Use the verified opening account digits, for example 17 or 20.";
    }

    return "Use only BIN/IIN digits. You can add a range by filling End Value too.";
  }, [identifierType]);

  const valuePlaceholder =
    identifierType === "iban_prefix"
      ? "e.g. XK0517"
      : identifierType === "account_prefix"
      ? "e.g. 17"
      : "e.g. 423260";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const identifierTypeValue = String(formData.get("identifier_type") || "").trim() as BankIdentifierType;
    const normalizedValue = normalizeRuleValue(
      String(formData.get("value") || "").trim(),
      identifierTypeValue
    );
    const normalizedValueEnd = normalizeRuleValue(
      String(formData.get("value_end") || "").trim(),
      identifierTypeValue
    );
    const scheme = String(formData.get("scheme") || "").trim().toLowerCase();
    const countryCode = String(formData.get("country_code") || "").trim().toUpperCase();

    formData.set("identifier_type", identifierTypeValue);
    formData.set("value", normalizedValue);
    formData.set("value_end", normalizedValueEnd);
    formData.set("scheme", identifierTypeValue === "card_bin" ? scheme : "");
    formData.set("country_code", countryCode);

    startTransition(async () => {
      const result = await action(formData);
      if (!result.success) {
        setError(result.error || "Unable to save rule.");
        return;
      }

      router.push(successRedirectHref);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save rule</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="bank_id" label="Bank" required>
          <select
            id="bank_id"
            name="bank_id"
            className={nativeSelectClassName}
            defaultValue={initialValues?.bank_id || ""}
            required
          >
            <option value="">Select bank</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="identifier_type"
          label="Rule Type"
          required
          hint="Choose how the detector should interpret this rule."
        >
          <select
            id="identifier_type"
            name="identifier_type"
            className={nativeSelectClassName}
            value={identifierType}
            onChange={(event) => {
              const nextType = event.target.value as BankIdentifierType;
              setIdentifierType(nextType);
              setValue((current) => normalizeRuleValue(current, nextType));
              setValueEnd((current) => normalizeRuleValue(current, nextType));
              if (nextType !== "card_bin") {
                setScheme("");
              }
            }}
            required
          >
            <option value="iban_prefix">IBAN Prefix</option>
            <option value="account_prefix">Account Prefix</option>
            <option value="card_bin">Card BIN</option>
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="value"
          label="Start Value"
          required
          hint={valueHint}
        >
          <Input
            id="value"
            name="value"
            value={value}
            onChange={(event) =>
              setValue(normalizeRuleValue(event.target.value, identifierType))
            }
            placeholder={valuePlaceholder}
            required
            className="uppercase"
            inputMode={identifierType === "card_bin" ? "numeric" : "text"}
          />
        </FormField>

        <FormField
          id="value_end"
          label="End Value"
          hint="Optional. Use only when the rule represents a range."
        >
          <Input
            id="value_end"
            name="value_end"
            value={valueEnd}
            onChange={(event) =>
              setValueEnd(normalizeRuleValue(event.target.value, identifierType))
            }
            placeholder="e.g. 423299"
            className="uppercase"
            inputMode={identifierType === "card_bin" ? "numeric" : "text"}
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          id="scheme"
          label="Card Scheme"
          hint="Useful only for card BIN rules."
        >
          <select
            id="scheme"
            name="scheme"
            className={nativeSelectClassName}
            value={scheme}
            onChange={(event) => setScheme(event.target.value)}
            disabled={identifierType !== "card_bin"}
          >
            <option value="">Select scheme</option>
            {(["visa", "mastercard", "amex", "discover", "diners"] satisfies CardScheme[]).map(
              (option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              )
            )}
          </select>
        </FormField>

        <FormField
          id="country_code"
          label="Country Code"
          hint="Optional. Use ISO country code when relevant."
        >
          <Input
            id="country_code"
            name="country_code"
            defaultValue={initialValues?.country_code || "XK"}
            placeholder="e.g. XK"
            className="uppercase"
          />
        </FormField>

        <FormField
          id="priority"
          label="Priority"
          hint="Lower numbers win first when multiple rules match."
        >
          <Input
            id="priority"
            name="priority"
            type="number"
            min="0"
            step="1"
            defaultValue={String(initialValues?.priority ?? 100)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="source" label="Source" hint="Record where this rule came from.">
          <Input
            id="source"
            name="source"
            defaultValue={initialValues?.source || ""}
            placeholder="e.g. verified from official bank documentation"
          />
        </FormField>

        <FormField id="notes" label="Notes" hint="Internal context for future review.">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={initialValues?.notes || ""}
            placeholder="Short explanation of the rule."
            rows={3}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2">
        <Checkbox
          id="is_active"
          name="is_active"
          defaultChecked={initialValues?.is_active ?? true}
        />
        <span>Rule is active</span>
      </label>

      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push(cancelHref)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
