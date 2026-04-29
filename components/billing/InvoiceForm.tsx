"use client";

import { useMemo, useState } from "react";
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

type PromotionCodeOption = {
  id: string;
  code: string;
  assigned_email: string | null;
  status: string | null;
  expires_at: string | null;
  redemption_count: number | null;
  max_redemptions: number | null;
  campaign:
    | {
        id: string;
        name: string | null;
        discount_type: "percent" | "fixed_amount";
        discount_percent: number | string | null;
        discount_amount_cents: number | null;
        applies_to: "package_fee" | "service_lines" | "both";
        active: boolean | null;
        starts_at: string | null;
        ends_at: string | null;
      }
    | {
        id: string;
        name: string | null;
        discount_type: "percent" | "fixed_amount";
        discount_percent: number | string | null;
        discount_amount_cents: number | null;
        applies_to: "package_fee" | "service_lines" | "both";
        active: boolean | null;
        starts_at: string | null;
        ends_at: string | null;
      }[]
    | null;
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
  promotionCodes?: PromotionCodeOption[];
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
  promotionCodes = [],
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
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "errors" in error &&
        Array.isArray(error.errors)
      ) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path =
            typeof err === "object" &&
            err !== null &&
            "path" in err &&
            Array.isArray(err.path)
              ? err.path.join(".")
              : "_form";
          const message =
            typeof err === "object" &&
            err !== null &&
            "message" in err &&
            typeof err.message === "string"
              ? err.message
              : "Invalid value";
          formattedErrors[path] = [message];
        });
        setErrors(formattedErrors);
      } else {
        const message = error instanceof Error ? error.message : null;
        setErrors({
          _form: [
            message ||
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
        <Alert variant="destructive">
          <AlertTitle>
            {mode === "edit" ? "Unable to update invoice" : "Unable to create invoice"}
          </AlertTitle>
          <AlertDescription>{errors._form[0]}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField id="client" label="Client" required error={errors.client_id?.[0]}>
          <Select
            value={clientId}
            onValueChange={(value) => {
              setClientId(value);
              if (!(mode === "edit" && initialValues)) {
                setPropertyId("none");
                setItems([createInitialItem()]);
              }
            }}
          >
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
        </FormField>

        <FormField
          id="property"
          label="Property"
          required
          hint="Only properties with an active subscription for this client are shown."
        >
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
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField id="issue-date" label="Invoice Date" required>
          <Input
            id="issue-date"
            type="date"
            value={issueDate}
            onChange={(e) => {
              const nextIssueDate = e.target.value;
              setIssueDate(nextIssueDate);
              if (mode === "create") {
                setDueDate(addDays(nextIssueDate, 14));
              }
            }}
          />
        </FormField>

        <FormField
          id="due-date"
          label="Due Date"
          required
          hint={
            mode === "create"
              ? "Automatically set to 14 days after the invoice date."
              : undefined
          }
        >
          <Input
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            readOnly={mode === "create"}
          />
        </FormField>
      </div>

      <LineItemsEditor
        items={items}
        onChange={setItems}
        errors={errors}
        clientId={clientId}
        propertyId={propertyId}
        subscriptions={subscriptions}
        services={services}
        promotionCodes={promotionCodes}
      />

      <FormField id="notes" label="Notes">
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes or instructions..."
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
            <span>Total</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

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
