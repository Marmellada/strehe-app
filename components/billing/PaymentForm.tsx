"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

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
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount (€)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={centsToEur(balanceDueCents)}
            defaultValue={defaultAmount}
            className="input w-full"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Payment Method</label>
          <select
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
        </div>
      </div>

      {paymentMethod === "bank_transfer" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Bank</label>
          <select name="bank_id" className="input w-full" defaultValue="" required>
            <option value="">Select bank</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
                {bank.swift_code ? ` (${bank.swift_code})` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Required when payment method is Bank Transfer.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Reference Number</label>
        <input
          name="reference_number"
          type="text"
          className="input w-full"
          placeholder="Optional bank/payment reference"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          className="input w-full min-h-[100px]"
          placeholder="Optional notes"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">Save Payment</Button>

        <Button asChild type="button" variant="outline">
          <Link href={`/billing/${invoiceId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}