"use client";

import { useMemo, useState } from "react";
import type { BankIdentifierRule, BankRegistryBank } from "@/types/banking";
import { detectBankFromInput } from "@/lib/banking/detection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { DetailField } from "@/components/ui/DetailField";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

function normalizeDetectionInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type BankDetectionPlaygroundProps = {
  banks: BankRegistryBank[];
  identifiers: BankIdentifierRule[];
  identifierSourceMessage?: string | null;
};

export function BankDetectionPlayground({
  banks,
  identifiers,
  identifierSourceMessage,
}: BankDetectionPlaygroundProps) {
  const [input, setInput] = useState("");
  const exampleInputs = [
    {
      label: "Kosovo IBAN example",
      value: "XK051212012345678906",
    },
    {
      label: "Card example",
      value: "4111111111111111",
    },
    {
      label: "Account number example",
      value: "1701018501077439",
    },
  ];

  const result = useMemo(
    () =>
      detectBankFromInput({
        input,
        identifiers,
        banks,
      }),
    [banks, identifiers, input]
  );

  return (
    <div className="space-y-6">
      {identifierSourceMessage ? (
        <Alert variant="warning">
          <AlertTitle>Detection rules not fully wired yet</AlertTitle>
          <AlertDescription>{identifierSourceMessage}</AlertDescription>
        </Alert>
      ) : null}

      <SectionCard
        title="Detection Playground"
        description="Type an IBAN, account number, or card number and inspect how the internal banking detector classifies and validates it."
      >
        <div className="space-y-4">
          <FormField
            id="bank-detection-input"
            label="IBAN / Account Number / Card Number"
            hint="This is an internal tester only. Use fake or masked values."
          >
            <Input
              id="bank-detection-input"
              value={input}
              onChange={(event) =>
                setInput(normalizeDetectionInput(event.target.value))
              }
              placeholder="e.g. XK051212012345678906"
              className="uppercase"
            />
          </FormField>

          <div className="flex flex-wrap gap-2">
            {exampleInputs.map((example) => (
              <button
                key={example.label}
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => setInput(normalizeDetectionInput(example.value))}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Detection Result"
        description="The service classifies input first, then validates and tries to match bank rules."
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Kind" value={result.kind} />
        <DetailField
          label="Validation"
          value={<StatusBadge status={result.isValid ? "active" : "error"} />}
        />
        <DetailField label="Normalized Input" value={result.normalizedInput || "-"} />
        <DetailField label="Message" value={result.validationMessage} />
        <DetailField label="Country Code" value={result.countryCode || "-"} />
        <DetailField label="Card Scheme" value={result.cardScheme || "-"} />
        <DetailField
          label="Available Rules"
          value={String(result.availableRuleCount)}
        />
        <DetailField
          label="Detected Bank"
          value={result.matchedBank?.bankName || "No bank matched"}
        />
        <DetailField
          label="Matched By"
          value={result.matchedBank?.matchedBy || "-"}
        />
        <DetailField
          label="Matched Value"
          value={result.matchedBank?.matchedValue || "-"}
        />
        <DetailField
          label="Detected SWIFT"
          value={result.matchedBank?.swiftCode || "-"}
        />
      </SectionCard>

      <SectionCard
        title="Interpretation"
        description="This explains the detector outcome in plain language."
      >
        <div className="text-sm text-muted-foreground">
          {!input.trim()
            ? "Enter a test value to see how the detector classifies, validates, and matches it."
            : !result.isValid
            ? result.validationMessage
            : result.matchedBank
            ? `Matched ${result.matchedBank.bankName} using ${result.matchedBank.matchedBy} rule ${result.matchedBank.matchedValue}.`
            : result.kind === "card_number" && result.cardScheme && result.cardScheme !== "unknown"
            ? `The card number format looks valid and the scheme appears to be ${result.cardScheme}, but no issuer-bank BIN rule matched it yet.`
            : result.availableRuleCount > 0
            ? `The ${result.kind.replaceAll("_", " ")} looks valid, but none of the currently active rules matched it.`
            : `The ${result.kind.replaceAll("_", " ")} looks valid, but there are no active rules of that type yet.`}
        </div>
      </SectionCard>
    </div>
  );
}
