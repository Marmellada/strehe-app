"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, FormField, Input, Textarea } from "@/components/ui";

type BankOption = {
  id: string;
  account_type: "bank" | "cash";
  name: string;
  bank_name?: string | null;
  swift_code: string | null;
};

type PaymentFormProps = {
  invoiceId: string;
  balanceDueCents: number;
  banks: BankOption[];
  action: (formData: FormData) => void;
};

function centsToEur(cents: number) {
  return (cents || 0) / 100;
}

export function PaymentForm({
  invoiceId,
  balanceDueCents,
  banks,
  action,
}: PaymentFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cash">(
    "bank_transfer"
  );

  const defaultAmount = useMemo(() => {
    return centsToEur(balanceDueCents).toFixed(2);
  }, [balanceDueCents]);
  const filteredAccounts = useMemo(
    () =>
      banks.filter((account) =>
        paymentMethod === "cash"
          ? account.account_type === "cash"
          : account.account_type === "bank"
      ),
    [banks, paymentMethod]
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="invoice_id" value={invoiceId} />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="payment-amount" label="Amount (€)" required>
          <Input
            id="payment-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={centsToEur(balanceDueCents)}
            defaultValue={defaultAmount}
            required
          />
        </FormField>

        <FormField id="payment-method" label="Payment Method" required>
          <select
            id="payment-method"
            name="payment_method"
            className="input w-full"
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as "bank_transfer" | "cash")
            }
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
          </select>
        </FormField>
      </div>

      <FormField
        id="payment-company-account"
        label={paymentMethod === "cash" ? "Cash Account" : "Received Into"}
        required
        hint={
          paymentMethod === "cash"
            ? "Choose the cash box / petty cash account that received the payment."
            : "Choose the company account that received the transfer."
        }
      >
        <select
          id="payment-company-account"
          name="company_account_id"
          className="input w-full"
          defaultValue=""
          required
        >
          <option value="">
            {paymentMethod === "cash" ? "Select cash account" : "Select company account"}
          </option>
          {filteredAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.account_type === "bank" && account.bank_name
                ? ` — ${account.bank_name}${account.swift_code ? ` (${account.swift_code})` : ""}`
                : ""}
            </option>
          ))}
        </select>
      </FormField>

      {paymentMethod === "bank_transfer" && (
        <FormField
          id="payment-bank"
          label="Transfer Routing"
          hint="The selected company account will be used as the receiving bank account."
        >
          <Input
            id="payment-bank"
            value="Transfer received into the selected company account"
            readOnly
          />
        </FormField>
      )}

      <FormField id="payment-reference" label="Reference Number">
        <Input
          id="payment-reference"
          name="reference_number"
          type="text"
          placeholder="Optional bank/payment reference"
        />
      </FormField>

      <FormField id="payment-notes" label="Notes">
        <Textarea
          id="payment-notes"
          name="notes"
          placeholder="Optional notes"
        />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit">Save Payment</Button>

        <Button asChild type="button" variant="outline">
          <Link href={`/billing/${invoiceId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
