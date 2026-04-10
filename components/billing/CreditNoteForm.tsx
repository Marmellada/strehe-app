"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  FormField,
  Input,
  Textarea,
} from "@/components/ui";
import { LineItemsEditor } from "@/components/billing/LineItemsEditor";
import { createCreditNote } from "@/lib/actions/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { LineItemInput } from "@/lib/validations/billing";

interface CreditNoteFormProps {
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  initialItems: LineItemInput[];
}

function normalizeInitialItems(items: LineItemInput[]): LineItemInput[] {
  if (!items.length) {
    return [
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 18,
        temp_id: "credit-note-item-0",
      },
    ];
  }

  return items.map((item, index) => ({
    ...item,
    temp_id: item.temp_id || `credit-note-item-${index}`,
  }));
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
  const [items, setItems] = useState<LineItemInput[]>(normalizeInitialItems(initialItems));

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
    } catch (error: unknown) {
      setErrors({
        _form: [
          error instanceof Error
            ? error.message
            : "Failed to create credit note",
        ],
      });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <Alert variant="destructive">
          <AlertTitle>Unable to create credit note</AlertTitle>
          <AlertDescription>{errors._form[0]}</AlertDescription>
        </Alert>
      )}

      <Card size="sm">
        <CardContent className="space-y-1 pt-0">
          <div className="text-sm text-muted-foreground">Original Invoice</div>
          <div className="text-lg font-semibold">{originalInvoiceNumber}</div>
        </CardContent>
      </Card>

      <FormField id="issue-date" label="Credit Note Date" required>
        <Input
          id="issue-date"
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
        />
      </FormField>

      <LineItemsEditor
        items={items}
        onChange={setItems}
        errors={errors}
        clientId=""
        propertyId="none"
        subscriptions={[]}
        services={[]}
      />

      <FormField id="notes" label="Notes">
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for credit note..."
          rows={3}
        />
      </FormField>

      <Card size="sm">
        <CardContent className="space-y-2 pt-0">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT</span>
            <span>€{totalVat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <span>Credit Total</span>
            <span>-€{total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

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
