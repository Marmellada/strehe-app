"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, FormField, Input, Textarea } from "@/components/ui";

type BankOption = {
  id: string;
  name: string;
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

      {paymentMethod === "bank_transfer" && (
        <FormField
          id="payment-bank"
          label="Bank"
          required
          hint="Required when payment method is Bank Transfer."
        >
          <select id="payment-bank" name="bank_id" className="input w-full" defaultValue="" required>
            <option value="">Select bank</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
                {bank.swift_code ? ` (${bank.swift_code})` : ""}
              </option>
            ))}
          </select>
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
