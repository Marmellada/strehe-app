"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { detectBankFromInput } from "@/lib/banking/detection";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import type { BankDetectionResult, BankIdentifierRule } from "@/types/banking";

function normalizeUppercaseAlphaNumeric(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

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

type BankAccountInitialValues = {
  bank_id?: string | null;
  account_name?: string | null;
  bank_name_snapshot?: string | null;
  iban?: string | null;
  swift?: string | null;
  is_primary?: boolean | null;
  show_on_invoice?: boolean | null;
};

interface BankAccountFormProps {
  action: (formData: FormData) => Promise<BankAccountActionResult>;
  banks?: BankOption[];
  identifiers?: BankIdentifierRule[];
  initialValues?: BankAccountInitialValues;
  submitLabel?: string;
  cancelHref?: string;
  successRedirectHref?: string;
}

export function BankAccountForm({
  action,
  banks,
  identifiers,
  initialValues,
  submitLabel = "Save Account",
  cancelHref = "/settings/banking",
  successRedirectHref = "/settings/banking",
}: BankAccountFormProps) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>(
    initialValues?.bank_id ?? ""
  );
  const [ibanValue, setIbanValue] = useState<string>(initialValues?.iban ?? "");
  const [displayBankName, setDisplayBankName] = useState<string>(
    initialValues?.bank_name_snapshot ?? ""
  );
  const [swiftValue, setSwiftValue] = useState<string>(initialValues?.swift ?? "");
  const [bankWasManuallySelected, setBankWasManuallySelected] = useState<boolean>(
    !!initialValues?.bank_id
  );
  const [displayNameWasManuallyEdited, setDisplayNameWasManuallyEdited] =
    useState<boolean>(!!initialValues?.bank_name_snapshot);
  const [swiftWasManuallyEdited, setSwiftWasManuallyEdited] = useState<boolean>(
    !!initialValues?.swift
  );

  const selectedBank = useMemo(
    () => (banks || []).find((bank) => bank.id === selectedBankId) || null,
    [banks, selectedBankId]
  );

  const detectionResult = useMemo<BankDetectionResult | null>(() => {
    if (!ibanValue.trim()) return null;

    return detectBankFromInput({
      input: ibanValue,
      identifiers: identifiers || [],
      banks: banks || [],
    });
  }, [banks, ibanValue, identifiers]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const iban = String(formData.get("iban") || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    const swift = String(formData.get("swift_bic") || "").trim().toUpperCase();

    formData.set("iban", iban);
    formData.set("swift_bic", swift);

    startTransition(async () => {
      try {
        const result = await action(formData);

        if (!result.success) {
          setError(result.error || "An unexpected error occurred");
          return;
        }

        if (successRedirectHref) {
          router.push(successRedirectHref);
          router.refresh();
          return;
        }

        form.reset();
        setSelectedBankId("");
        setIbanValue("");
        setDisplayBankName("");
        setSwiftValue("");
        setBankWasManuallySelected(false);
        setDisplayNameWasManuallyEdited(false);
        setSwiftWasManuallyEdited(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save bank account</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id="bank_id"
        label="Bank"
        required
        hint="Choose the bank institution this account belongs to."
      >
        <select
          id="bank_id"
          name="bank_id"
          className={nativeSelectClassName}
          required
          value={selectedBankId}
          onChange={(e) => {
            const nextBankId = e.target.value;
            const nextBank = (banks || []).find((bank) => bank.id === nextBankId) || null;
            setSelectedBankId(nextBankId);
            setBankWasManuallySelected(true);
            if (nextBank && (!displayNameWasManuallyEdited || !displayBankName.trim())) {
              setDisplayBankName(nextBank.name);
            }
            if (
              nextBank?.swift_code &&
              (!swiftWasManuallyEdited || !swiftValue.trim())
            ) {
              setSwiftValue(nextBank.swift_code);
            }
          }}
        >
          <option value="">Select a bank</option>
          {(banks || []).map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.name}
            </option>
          ))}
        </select>
      </FormField>

      <input
        type="hidden"
        name="bank_name"
        value={selectedBank?.name || displayBankName || ""}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="account_name"
          label="Account Name"
          required
          hint="Use the formal company account name shown by the bank."
        >
          <Input
            id="account_name"
            name="account_name"
            placeholder="e.g., Strehe-Prona SHPK - Business Account"
            defaultValue={initialValues?.account_name || ""}
            required
          />
        </FormField>

        <FormField
          id="bank_name_snapshot"
          label="Display Bank Name"
          required
          hint="This is the bank name shown on invoices and payment details."
        >
          <Input
            id="bank_name_snapshot"
            name="bank_name_snapshot"
            value={displayBankName}
            onChange={(event) => {
              setDisplayBankName(event.target.value.toUpperCase());
              setDisplayNameWasManuallyEdited(true);
            }}
            placeholder="e.g., Raiffeisen Bank Kosovo"
            required
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="iban"
          label="IBAN"
          required
          hint="Kosovo format: XK followed by 18 digits."
        >
          <Input
            id="iban"
            name="iban"
            value={ibanValue}
            onChange={(event) => {
              const nextValue = normalizeUppercaseAlphaNumeric(event.target.value);
              setIbanValue(nextValue);

              const nextDetection = detectBankFromInput({
                input: nextValue,
                identifiers: identifiers || [],
                banks: banks || [],
              });

              const matchedBank = nextDetection.matchedBank;
              if (!matchedBank) return;

              if (!bankWasManuallySelected) {
                setSelectedBankId(matchedBank.bankId);
              }

              if (!displayNameWasManuallyEdited || !displayBankName.trim()) {
                setDisplayBankName(matchedBank.bankName);
              }

              if (
                matchedBank.swiftCode &&
                (!swiftWasManuallyEdited || !swiftValue.trim())
              ) {
                setSwiftValue(matchedBank.swiftCode);
              }
            }}
            placeholder="e.g., XK051212012345678906"
            required
            pattern="^XK\\d{18}$"
            title="Must be in format XK followed by 18 digits"
            className="uppercase"
          />
        </FormField>

        <FormField
          id="swift"
          label="SWIFT / BIC"
          hint="Optional. Use the bank's official SWIFT/BIC code if available."
        >
          <Input
            id="swift"
            name="swift_bic"
            value={swiftValue}
            onChange={(event) => {
              setSwiftValue(normalizeUppercaseAlphaNumeric(event.target.value));
              setSwiftWasManuallyEdited(true);
            }}
            placeholder="e.g., RBKOXKPR"
            pattern="^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$"
            title="Must be 8 or 11 characters"
            className="uppercase"
          />
        </FormField>
      </div>

      {detectionResult && ibanValue.trim() ? (
        <Alert
          variant={
            !detectionResult.isValid
              ? "destructive"
              : detectionResult.matchedBank
              ? "success"
              : "warning"
          }
        >
          <AlertTitle>Bank detection</AlertTitle>
          <AlertDescription>
            {!detectionResult.isValid
              ? detectionResult.validationMessage
              : detectionResult.matchedBank
              ? `Matched ${detectionResult.matchedBank.bankName} using ${detectionResult.matchedBank.matchedBy} rule ${detectionResult.matchedBank.matchedValue}. Bank, display name, and SWIFT were auto-filled where available. You can still edit them.`
              : detectionResult.availableRuleCount > 0
              ? "The IBAN format looks valid, but no active bank rule matched it yet."
              : "The IBAN format looks valid, but there are no active IBAN rules yet."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2">
          <Checkbox
            id="is_primary"
            name="is_primary"
            defaultChecked={!!initialValues?.is_primary}
          />
          <span>Set as primary account</span>
        </label>

        <label className="flex items-center gap-2">
          <Checkbox
            id="show_on_invoice"
            name="show_on_invoice"
            defaultChecked={initialValues?.show_on_invoice ?? true}
          />
          <span>Show on invoice</span>
        </label>
      </div>

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
