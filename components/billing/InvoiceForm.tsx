"use client";
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LineItemsEditor } from "./LineItemsEditor";
import { createInvoice } from "@/lib/actions/billing";
import { computeInvoiceTotals } from "@/lib/billing-helpers";
import type { CreateInvoiceInput, LineItemInput } from "@/lib/validations/billing";
import type { Database } from "@/types/supabase";

type Property = Database["public"]["Tables"]["properties"]["Row"];
type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Bank = Database["public"]["Tables"]["banks"]["Row"];
interface InvoiceFormProps {
  properties: Property[];
  units: Database["public"]["Tables"]["units"]["Row"][];
  tenants: Tenant[];
  clients: Client[];
  banks: Bank[];
}

export function InvoiceForm({ properties, units, tenants, clients, banks }: InvoiceFormProps) {

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Form state
  const [invoiceType, setInvoiceType] = useState<"property_tenant" | "client">("property_tenant");
  const [propertyId, setPropertyId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [paymentTerms, setPaymentTerms] = useState<string>("Net 30");
  const [notes, setNotes] = useState<string>("");
  const [bankId, setBankId] = useState<string>("");
  const [items, setItems] = useState<LineItemInput[]>([
    {
      description: "",
      quantity: 1,
      unit_price: 0,
      vat_rate: 18,
      temp_id: "initial",
    },
  ]);

  // Filter tenants by selected property
  const filteredTenants = tenants.filter((t) => t.property_id === propertyId);

  // Compute totals
  const { subtotal, totalVat, total } = computeInvoiceTotals(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const data: CreateInvoiceInput = {
        invoice_type: invoiceType,
        property_id: invoiceType === "property_tenant" ? propertyId : null,
        tenant_id: invoiceType === "property_tenant" ? tenantId : null,
        client_id: invoiceType === "client" ? clientId : null,
        issue_date: issueDate,
        due_date: dueDate,
        payment_terms: paymentTerms || null,
        notes: notes || null,
        bank_id: bankId,
        items,
      };

      await createInvoice(data);
      // Redirect happens in server action
    } catch (error: any) {
      if (error.errors) {
        // Zod validation errors
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err: any) => {
          const path = err.path.join(".");
          formattedErrors[path] = [err.message];
        });
        setErrors(formattedErrors);
      } else {
        setErrors({ _form: [error.message || "Failed to create invoice"] });
      }
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {errors._form && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {errors._form[0]}
        </div>
      )}

      {/* Invoice Type */}
      <div className="space-y-2">
        <Label>Invoice Type</Label>
        <RadioGroup value={invoiceType} onValueChange={(v: any) => setInvoiceType(v)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="property_tenant" id="type-property" />
            <Label htmlFor="type-property" className="font-normal cursor-pointer">
              Property & Tenant
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="client" id="type-client" />
            <Label htmlFor="type-client" className="font-normal cursor-pointer">
              Client
            </Label>
          </div>
        </RadioGroup>
        {errors.invoice_type && (
          <p className="text-sm text-red-600">{errors.invoice_type[0]}</p>
        )}
      </div>

      {/* Property & Tenant Selection */}
      {invoiceType === "property_tenant" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="property">Property *</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger id="property">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.property_id && (
              <p className="text-sm text-red-600">{errors.property_id[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant">Tenant *</Label>
            <Select value={tenantId} onValueChange={setTenantId} disabled={!propertyId}>
              <SelectTrigger id="tenant">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {filteredTenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.first_name} {tenant.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tenant_id && (
              <p className="text-sm text-red-600">{errors.tenant_id[0]}</p>
            )}
          </div>
        </div>
      )}

      {/* Client Selection */}
      {invoiceType === "client" && (
        <div className="space-y-2">
          <Label htmlFor="client">Client *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.client_id && (
            <p className="text-sm text-red-600">{errors.client_id[0]}</p>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
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

      {/* Bank Account */}
      <div className="space-y-2">
        <Label htmlFor="bank">Bank Account *</Label>
        <Select value={bankId} onValueChange={setBankId}>
          <SelectTrigger id="bank">
            <SelectValue placeholder="Select bank account" />
          </SelectTrigger>
          <SelectContent>
            {banks.map((bank) => (
              <SelectItem key={bank.id} value={bank.id}>
                {bank.bank_name} - {bank.account_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.bank_id && (
          <p className="text-sm text-red-600">{errors.bank_id[0]}</p>
        )}
      </div>

      {/* Payment Terms */}
      <div className="space-y-2">
        <Label htmlFor="payment-terms">Payment Terms</Label>
        <Input
          id="payment-terms"
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          placeholder="E.g., Net 30"
        />
      </div>

      {/* Line Items */}
      <LineItemsEditor items={items} onChange={setItems} errors={errors} />

      {/* Notes */}
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

      {/* Totals Summary */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total VAT:</span>
          <span>€{totalVat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg pt-2 border-t">
          <span>Total:</span>
          <span>€{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
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
