"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { LineItemsEditor } from "./LineItemsEditor";
import { createInvoice } from "@/lib/actions/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { LineItemInput } from "@/lib/validations/billing";


type PropertyOption = {
  id: string;
  title: string;
};

type ClientOption = {
  id: string;
  full_name: string | null;
  company_name: string | null;
};

type BankRelation =
  | {
      id: string;
      name: string;
      swift_code: string | null;
    }
  | {
      id: string;
      name: string;
      swift_code: string | null;
    }[]
  | null
  | undefined;

type BankAccountOption = {
  id: string;
  bank_id: string | null;
  iban: string;
  account_name: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  banks?: BankRelation;
};

interface InvoiceFormProps {
  properties: PropertyOption[];
  clients: ClientOption[];
  bankAccounts: BankAccountOption[];
}

export function InvoiceForm({
  properties,
  clients,
  bankAccounts,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [clientId, setClientId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [items, setItems] = useState<LineItemInput[]>([
    {
      description: "",
      quantity: 1,
      unit_price: 0,
      vat_rate: 18,
      temp_id: "initial",
    },
  ]);

  const { subtotal, totalVat, total } = computeInvoiceTotals(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const data = {
        invoice_type: "standard",
        client_id: clientId,
        property_id: propertyId || null,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes || null,
        bank_account_id: bankAccountId,
        items,
      };

      await createInvoice(data as any);
    } catch (error: any) {
      if (error?.errors) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err: any) => {
          const path = err.path.join(".");
          formattedErrors[path] = [err.message];
        });
        setErrors(formattedErrors);
      } else {
        setErrors({ _form: [error?.message || "Failed to create invoice"] });
      }
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client">Client *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.full_name || client.company_name || "Unnamed client"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.client_id && (
            <p className="text-sm text-red-600">{errors.client_id[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="property">Property</Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger id="property">
              <SelectValue placeholder="Optional property link" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.property_id && (
            <p className="text-sm text-red-600">{errors.property_id[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="issue-date">Issue Date *</Label>
          <Input
            id="issue-date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          {errors.issue_date && (
            <p className="text-sm text-red-600">{errors.issue_date[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="due-date">Due Date *</Label>
          <Input
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {errors.due_date && (
            <p className="text-sm text-red-600">{errors.due_date[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank-account">Bank Account *</Label>
        <Select value={bankAccountId} onValueChange={setBankAccountId}>
          <SelectTrigger id="bank-account">
            <SelectValue placeholder="Select company bank account" />
          </SelectTrigger>
          <SelectContent>
            {bankAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {(
  Array.isArray(account.banks)
    ? account.banks[0]?.name
    : account.banks?.name
) || "Bank"}{" "}
— {account.iban}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.bank_account_id && (
          <p className="text-sm text-red-600">{errors.bank_account_id[0]}</p>
        )}
      </div>

      <LineItemsEditor items={items} onChange={setItems} errors={errors} />

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes or instructions..."
          rows={3}
        />
      </div>

      <div className="space-y-2 rounded-lg bg-gray-50 p-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total VAT:</span>
          <span>€{totalVat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-lg font-semibold">
          <span>Total:</span>
          <span>€{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Invoice"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}