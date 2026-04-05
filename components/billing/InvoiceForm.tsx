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

type BillingSourceType = "package" | "service";

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
  const initialItems =
    initialValues?.items?.length
      ? initialValues.items
      : [
          {
            description: "",
            quantity: 1,
            unit_price: 0,
            vat_rate: 18,
            temp_id: "initial",
          },
        ];

  const initialSourceType: BillingSourceType =
    initialValues?.subscription_id ? "package" : "service";

  const initialSelectedSubscriptionId = initialValues?.subscription_id || "";
  const initialSelectedServiceId = "";
  const initialMonths =
    initialValues?.subscription_id && initialValues.items?.[0]?.quantity
      ? Math.max(1, Number(initialValues.items[0].quantity) || 1)
      : 1;

  const [clientId, setClientId] = useState(initialClientId);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [issueDate, setIssueDate] = useState(initialIssueDate);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [sourceType, setSourceType] = useState<BillingSourceType>(initialSourceType);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(
    initialSelectedSubscriptionId
  );
  const [selectedServiceId, setSelectedServiceId] = useState(initialSelectedServiceId);
  const [months, setMonths] = useState(initialMonths);
  const [notes, setNotes] = useState(initialNotes);
  const [items, setItems] = useState<LineItemInput[]>(initialItems);

  useEffect(() => {
    if (mode === "edit") return;
    setDueDate(addDays(issueDate, 14));
  }, [issueDate, mode]);

  useEffect(() => {
    if (mode === "edit" && initialValues) return;

    setPropertyId("none");
    setSelectedSubscriptionId("");
    setSelectedServiceId("");
    setMonths(1);
    setItems([
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 18,
        temp_id: "initial",
      },
    ]);
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

  const filteredSubscriptions = useMemo(() => {
    if (propertyId === "none") return clientSubscriptions;
    return clientSubscriptions.filter((sub) => sub.property_id === propertyId);
  }, [clientSubscriptions, propertyId]);

  useEffect(() => {
    if (sourceType !== "package") return;
    if (!selectedSubscriptionId) return;

    const selected = filteredSubscriptions.find(
      (sub) => sub.id === selectedSubscriptionId
    );

    if (!selected) return;

    setPropertyId(selected.property_id);

    setItems((prev) => {
      const extra = prev.slice(1);
      return [
        {
          description: `${selected.package_name} - ${months} month${
            months > 1 ? "s" : ""
          }`,
          quantity: months,
          unit_price: selected.monthly_price,
          vat_rate: 18,
          temp_id: prev[0]?.temp_id || "initial",
        },
        ...extra,
      ];
    });
  }, [selectedSubscriptionId, months, filteredSubscriptions, sourceType]);

  useEffect(() => {
    if (sourceType !== "service") return;
    if (!selectedServiceId) return;

    const selected = services.find((service) => service.id === selectedServiceId);
    if (!selected) return;

    setItems((prev) => {
      const extra = prev.slice(1);
      return [
        {
          description: selected.name,
          quantity: 1,
          unit_price: selected.base_price,
          vat_rate: 18,
          temp_id: prev[0]?.temp_id || "initial",
        },
        ...extra,
      ];
    });
  }, [selectedServiceId, services, sourceType]);

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

    if (sourceType === "package" && !selectedSubscriptionId) {
      setErrors({ _form: ["Please select a package/subscription to bill"] });
      setIsLoading(false);
      return;
    }

    if (sourceType === "service") {
      if (propertyId === "none") {
        setErrors({
          _form: ["Please select one active property for this service invoice"],
        });
        setIsLoading(false);
        return;
      }
    }

    try {
      const payload = {
        invoice_type: "standard" as const,
        client_id: clientId,
        property_id: propertyId === "none" ? null : propertyId,
        subscription_id:
          sourceType === "package" ? selectedSubscriptionId || null : null,
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

        <div className="space-y-2">
          <Label htmlFor="source-type">Billing Source *</Label>
          <Select
            value={sourceType}
            onValueChange={(value) => setSourceType(value as BillingSourceType)}
          >
            <SelectTrigger id="source-type">
              <SelectValue placeholder="Select billing source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="package">Package</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sourceType === "package" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subscription">Package / Active Subscription *</Label>
            <Select
              value={selectedSubscriptionId}
              onValueChange={setSelectedSubscriptionId}
              disabled={!clientId}
            >
              <SelectTrigger id="subscription">
                <SelectValue placeholder="Select package to bill" />
              </SelectTrigger>
              <SelectContent>
                {filteredSubscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.package_name} — {sub.property_title} (€{sub.monthly_price.toFixed(2)}/mo)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="months">Months *</Label>
            <Input
              id="months"
              type="number"
              min="1"
              step="1"
              value={months}
              onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="service">Service *</Label>
          <Select
            value={selectedServiceId}
            onValueChange={setSelectedServiceId}
            disabled={!clientId}
          >
            <SelectTrigger id="service">
              <SelectValue placeholder="Select service to bill" />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name} — €{service.base_price.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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