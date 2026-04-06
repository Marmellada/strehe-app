"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { LineItemsEditor } from "./LineItemsEditor";
import { createInvoice, updateInvoice } from "@/lib/actions/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { LineItemInput } from "@/lib/validations/billing";

type ClientOption = {
  id: string;
  full_name: string | null;
  company_name: string | null;
};

type SubscriptionOption = {
  id: string;
  client_id: string;
  property_id: string;
  package_id: string;
  property_title: string;
  package_name: string;
  monthly_price: number;
};

type ServiceOption = {
  id: string;
  name: string;
  category: string | null;
  base_price: number;
};

type InvoiceFormInitialValues = {
  invoice_id?: string;
  client_id: string;
  property_id: string | null;
  subscription_id: string | null;
  issue_date: string;
  due_date: string;
  notes: string | null;
  items: LineItemInput[];
};

interface InvoiceFormProps {
  clients: ClientOption[];
  subscriptions: SubscriptionOption[];
  services: ServiceOption[];
  mode?: "create" | "edit";
  initialValues?: InvoiceFormInitialValues;
}

function formatDateInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function createInitialItem(): LineItemInput {
  return {
    description: "",
    quantity: 1,
    unit_price: 0,
    vat_rate: 18,
    temp_id: "initial-item-0",
  };
}

function normalizeInitialItems(items?: LineItemInput[]): LineItemInput[] {
  if (!items?.length) {
    return [createInitialItem()];
  }

  return items.map((item, index) => ({
    ...item,
    temp_id: item.temp_id || `initial-item-${index}`,
  }));
}

export function InvoiceForm({
  clients,
  subscriptions,
  services,
  mode = "create",
  initialValues,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const initialClientId = initialValues?.client_id || "";
  const initialPropertyId = initialValues?.property_id || "none";
  const initialIssueDate = initialValues?.issue_date || formatDateInput(new Date());
  const initialDueDate =
    initialValues?.due_date || addDays(formatDateInput(new Date()), 14);
  const initialNotes = initialValues?.notes || "";
  const initialItems = normalizeInitialItems(initialValues?.items);

  const [clientId, setClientId] = useState(initialClientId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [issueDate, setIssueDate] = useState(initialIssueDate);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [notes, setNotes] = useState(initialNotes);
  const [items, setItems] = useState<LineItemInput[]>(initialItems);

  useEffect(() => {
    if (mode === "edit") return;
    setDueDate(addDays(issueDate, 14));
  }, [issueDate, mode]);

  useEffect(() => {
    if (mode === "edit" && initialValues) return;

    setPropertyId("none");
    setItems([createInitialItem()]);
  }, [clientId, mode, initialValues]);

  const clientSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => sub.client_id === clientId);
  }, [subscriptions, clientId]);

  const filteredProperties = useMemo(() => {
    const unique = new Map<string, { id: string; title: string }>();

    clientSubscriptions.forEach((sub) => {
      if (!unique.has(sub.property_id)) {
        unique.set(sub.property_id, {
          id: sub.property_id,
          title: sub.property_title,
        });
      }
    });

    return Array.from(unique.values());
  }, [clientSubscriptions]);

  const { subtotal, totalVat, total } = computeInvoiceTotals(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    if (!clientId) {
      setErrors({ client_id: ["Client is required"] });
      setIsLoading(false);
      return;
    }

    if (propertyId === "none") {
      setErrors({
        _form: ["Please select one active property for this invoice"],
      });
      setIsLoading(false);
      return;
    }

    if (!items.length) {
      setErrors({
        _form: ["At least one line item is required"],
      });
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        invoice_type: "standard" as const,
        client_id: clientId,
        property_id: propertyId === "none" ? null : propertyId,
        subscription_id: null,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes || null,
        items,
      };

      const result =
        mode === "edit" && initialValues?.invoice_id
          ? await updateInvoice({
              invoice_id: initialValues.invoice_id,
              ...payload,
            })
          : await createInvoice(payload);

      if (result?.error) {
        setErrors({ _form: [result.error] });
        setIsLoading(false);
        return;
      }

      if (result?.success) {
        router.push(
          mode === "edit" && initialValues?.invoice_id
            ? `/billing/${initialValues.invoice_id}`
            : "/billing"
        );
        return;
      }

      setIsLoading(false);
    } catch (error: any) {
      if (error?.errors) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err: any) => {
          const path = err.path.join(".");
          formattedErrors[path] = [err.message];
        });
        setErrors(formattedErrors);
      } else {
        setErrors({
          _form: [
            error?.message ||
              (mode === "edit"
                ? "Failed to update invoice"
                : "Failed to create invoice"),
          ],
        });
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
                  {client.company_name || client.full_name || "Unnamed client"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.client_id && (
            <p className="text-sm text-red-600">{errors.client_id[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="property">Property *</Label>
          <Select value={propertyId} onValueChange={setPropertyId} disabled={!clientId}>
            <SelectTrigger id="property">
              <SelectValue placeholder="Select active property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select property</SelectItem>
              {filteredProperties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Only properties with an active subscription for this client are shown.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="issue-date">Invoice Date *</Label>
          <Input
            id="issue-date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due-date">Due Date *</Label>
          <Input
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            readOnly={mode === "create"}
          />
          {mode === "create" && (
            <p className="text-xs text-muted-foreground">
              Automatically set to 14 days after the invoice date.
            </p>
          )}
        </div>
      </div>

      <LineItemsEditor
        items={items}
        onChange={setItems}
        errors={errors}
        clientId={clientId}
        propertyId={propertyId}
        subscriptions={subscriptions}
        services={services}
      />

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
          <span>Total</span>
          <span>€{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? mode === "edit"
              ? "Saving..."
              : "Creating..."
            : mode === "edit"
              ? "Save Changes"
              : "Create Invoice"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              mode === "edit" && initialValues?.invoice_id
                ? `/billing/${initialValues.invoice_id}`
                : "/billing"
            )
          }
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}