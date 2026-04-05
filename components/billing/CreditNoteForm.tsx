"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { LineItemsEditor } from "@/components/billing/LineItemsEditor";
import { createCreditNote } from "@/lib/actions/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { LineItemInput } from "@/lib/validations/billing";

interface CreditNoteFormProps {
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  initialItems: LineItemInput[];
}

export function CreditNoteForm({
  originalInvoiceId,
  originalInvoiceNumber,
  initialItems,
}: CreditNoteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItemInput[]>(
    initialItems.length
      ? initialItems
      : [
          {
            description: "",
            quantity: 1,
            unit_price: 0,
            vat_rate: 18,
            temp_id: "initial",
          },
        ]
  );

  const { subtotal, totalVat, total } = computeInvoiceTotals(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const result = await createCreditNote({
        original_invoice_id: originalInvoiceId,
        issue_date: issueDate,
        notes: notes || null,
        items,
      });

      if (result?.error) {
        setErrors({ _form: [result.error] });
        setIsLoading(false);
        return;
      }

      if (result?.success && result.invoiceId) {
        router.push(`/billing/${result.invoiceId}`);
        return;
      }

      setIsLoading(false);
    } catch (error: any) {
      setErrors({ _form: [error?.message || "Failed to create credit note"] });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {errors._form[0]}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="text-sm text-muted-foreground">Original Invoice</div>
        <div className="text-lg font-semibold">{originalInvoiceNumber}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="issue-date">Credit Note Date *</Label>
        <Input
          id="issue-date"
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
        />
      </div>

      <LineItemsEditor items={items} onChange={setItems} errors={errors} />

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for credit note..."
          rows={3}
        />
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>VAT</span>
          <span>€{totalVat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-lg font-semibold">
          <span>Credit Total</span>
          <span>-€{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Credit Note"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/billing/${originalInvoiceId}`)}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}