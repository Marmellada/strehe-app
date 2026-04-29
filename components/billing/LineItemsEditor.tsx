"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Trash2, Plus } from "lucide-react";
import { computeLineItemTotal } from "@/lib/billing-helpers";
import type { LineItemInput } from "@/lib/validations/billing";
import { previewPromotionDiscount } from "@/lib/promotions/validation";

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

type RowSourceType = "manual" | "package" | "service";

type RowHelperState = {
  sourceType: RowSourceType;
  selectedSubscriptionId: string;
  selectedServiceId: string;
  months: number;
};

interface LineItemsEditorProps {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
  errors?: Record<string, string[]>;
  clientId: string;
  propertyId: string;
  subscriptions: SubscriptionOption[];
  services: ServiceOption[];
  promotionCodes?: PromotionCodeOption[];
}

function createRowId() {
  return Math.random().toString(36).slice(2, 11);
}

function getRowId(item: LineItemInput, index: number) {
  return item.temp_id || `row-${index}`;
}

export function LineItemsEditor({
  items,
  onChange,
  errors,
  clientId,
  propertyId,
  subscriptions,
  services,
  promotionCodes = [],
}: LineItemsEditorProps) {
  const [rowState, setRowState] = useState<Record<string, RowHelperState>>({});

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      if (sub.client_id !== clientId) return false;
      if (propertyId && propertyId !== "none" && sub.property_id !== propertyId) {
        return false;
      }
      return true;
    });
  }, [subscriptions, clientId, propertyId]);

  const addItem = () => {
    onChange([
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 18,
        temp_id: createRowId(),
      },
    ]);
  };

  const removeItem = (index: number) => {
    const rowId = getRowId(items[index], index);

    setRowState((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });

    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof LineItemInput,
    value: string | number
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const applyPromotionToRow = (index: number, codeValue: string) => {
    const normalized = codeValue.trim().toUpperCase();
    const updated = [...items];
    const item = updated[index];

    if (!normalized) {
      updated[index] = {
        ...item,
        promotion_code: "",
        promotion_code_id: null,
        original_unit_price: null,
        discount_amount: null,
        promotion_summary: null,
      };
      onChange(updated);
      return;
    }

    const promotion = promotionCodes.find(
      (candidate) => candidate.code.toUpperCase() === normalized
    );
    const campaign = Array.isArray(promotion?.campaign)
      ? promotion?.campaign[0] || null
      : promotion?.campaign;

    if (!promotion || !campaign) {
      updated[index] = {
        ...item,
        promotion_code: normalized,
        promotion_code_id: null,
        original_unit_price: null,
        discount_amount: null,
        promotion_summary: "Promotion code will be validated on save.",
      };
      onChange(updated);
      return;
    }

    const calculation = previewPromotionDiscount({
      discountType: campaign.discount_type,
      discountPercent: campaign.discount_percent,
      discountAmountCents: campaign.discount_amount_cents,
      monthlyPrice: item.original_unit_price || item.unit_price,
    });

    updated[index] = {
      ...item,
      promotion_code: normalized,
      promotion_code_id: promotion.id,
      original_unit_price: calculation.original,
      discount_amount: calculation.discount,
      promotion_summary: `${campaign.name || "Promotion"} applied with code ${promotion.code}. Normal price €${calculation.original.toFixed(2)}, final price €${calculation.final.toFixed(2)}.`,
      unit_price: calculation.final,
    };
    onChange(updated);
  };

  const updateRowState = (
    rowId: string,
    patch: Partial<RowHelperState>
  ) => {
    setRowState((prev) => ({
      ...prev,
      [rowId]: {
        sourceType: prev[rowId]?.sourceType || "manual",
        selectedSubscriptionId: prev[rowId]?.selectedSubscriptionId || "",
        selectedServiceId: prev[rowId]?.selectedServiceId || "",
        months: prev[rowId]?.months || 1,
        ...patch,
      },
    }));
  };

  const applyPackageToRow = (
    index: number,
    rowId: string,
    subscriptionId: string,
    months: number
  ) => {
    const selected = filteredSubscriptions.find((sub) => sub.id === subscriptionId);
    if (!selected) return;

    const updated = [...items];
    updated[index] = {
      ...updated[index],
      description: `${selected.package_name} - ${months} month${months > 1 ? "s" : ""}`,
      quantity: months,
      unit_price: selected.monthly_price,
      vat_rate: updated[index].vat_rate ?? 18,
    };
    onChange(updated);

    updateRowState(rowId, {
      sourceType: "package",
      selectedSubscriptionId: subscriptionId,
      selectedServiceId: "",
      months,
    });
  };

  const applyServiceToRow = (
    index: number,
    rowId: string,
    serviceId: string
  ) => {
    const selected = services.find((service) => service.id === serviceId);
    if (!selected) return;

    const updated = [...items];
    updated[index] = {
      ...updated[index],
      description: selected.name,
      quantity: updated[index].quantity || 1,
      unit_price: selected.base_price,
      original_unit_price: null,
      discount_amount: null,
      promotion_code: "",
      promotion_code_id: null,
      promotion_summary: null,
      vat_rate: updated[index].vat_rate ?? 18,
    };
    onChange(updated);

    updateRowState(rowId, {
      sourceType: "service",
      selectedServiceId: serviceId,
      selectedSubscriptionId: "",
    });
  };

  const handleSourceTypeChange = (
    index: number,
    rowId: string,
    value: RowSourceType
  ) => {
    updateRowState(rowId, {
      sourceType: value,
      selectedSubscriptionId:
        value === "package" ? rowState[rowId]?.selectedSubscriptionId || "" : "",
      selectedServiceId:
        value === "service" ? rowState[rowId]?.selectedServiceId || "" : "",
      months: rowState[rowId]?.months || 1,
    });

    if (value === "manual") {
      updateRowState(rowId, {
        sourceType: "manual",
        selectedSubscriptionId: "",
        selectedServiceId: "",
      });
    }

    if (value === "package" && rowState[rowId]?.selectedSubscriptionId) {
      applyPackageToRow(
        index,
        rowId,
        rowState[rowId].selectedSubscriptionId,
        rowState[rowId].months || 1
      );
    }

    if (value === "service" && rowState[rowId]?.selectedServiceId) {
      applyServiceToRow(index, rowId, rowState[rowId].selectedServiceId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Line Items</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {errors?.items && <p className="text-sm text-red-600">{errors.items[0]}</p>}

      <div className="space-y-3">
        {items.map((item, index) => {
          const rowId = getRowId(item, index);
          const helper = rowState[rowId] || {
            sourceType: "manual" as RowSourceType,
            selectedSubscriptionId: "",
            selectedServiceId: "",
            months: 1,
          };

          const { subtotal, vatAmount, total } = computeLineItemTotal(
            item.quantity,
            item.unit_price,
            item.vat_rate
          );

          return (
            <div key={rowId} className="space-y-4 rounded-2xl border bg-card p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor={`item-${rowId}-source-type`}>Line Type</Label>
                  <Select
                    value={helper.sourceType}
                    onValueChange={(value) =>
                      handleSourceTypeChange(index, rowId, value as RowSourceType)
                    }
                  >
                    <SelectTrigger id={`item-${rowId}-source-type`}>
                      <SelectValue placeholder="Select line type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="package">Package</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {helper.sourceType === "package" && (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`item-${rowId}-subscription`}>
                        Package / Active Subscription
                      </Label>
                      <Select
                        value={helper.selectedSubscriptionId}
                        onValueChange={(value) =>
                          applyPackageToRow(index, rowId, value, helper.months || 1)
                        }
                        disabled={!clientId}
                      >
                        <SelectTrigger id={`item-${rowId}-subscription`}>
                          <SelectValue placeholder="Select package to prefill this row" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredSubscriptions.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.package_name} — {sub.property_title} (€
                              {sub.monthly_price.toFixed(2)}/mo)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`item-${rowId}-months`}>Months</Label>
                      <Input
                        id={`item-${rowId}-months`}
                        type="number"
                        min="1"
                        step="1"
                        value={helper.months}
                        onChange={(e) => {
                          const nextMonths = Math.max(1, Number(e.target.value) || 1);
                          updateRowState(rowId, { months: nextMonths });

                          if (helper.selectedSubscriptionId) {
                            applyPackageToRow(
                              index,
                              rowId,
                              helper.selectedSubscriptionId,
                              nextMonths
                            );
                          }
                        }}
                      />
                    </div>
                  </>
                )}

                {helper.sourceType === "service" && (
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor={`item-${rowId}-service`}>Service</Label>
                    <Select
                      value={helper.selectedServiceId}
                      onValueChange={(value) => applyServiceToRow(index, rowId, value)}
                      disabled={!clientId}
                    >
                      <SelectTrigger id={`item-${rowId}-service`}>
                        <SelectValue placeholder="Select service to prefill this row" />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor={`item-${rowId}-description`}>Description</Label>
                <Input
                  id={`item-${rowId}-description`}
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                  placeholder="E.g., Monthly rent for Apartment 3B"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`item-${rowId}-quantity`}>Quantity</Label>
                  <Input
                    id={`item-${rowId}-quantity`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`item-${rowId}-unit-price`}>Unit Price (€)</Label>
                  <Input
                    id={`item-${rowId}-unit-price`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`item-${rowId}-vat-rate`}>VAT (%)</Label>
                  <Input
                    id={`item-${rowId}-vat-rate`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={item.vat_rate}
                    onChange={(e) =>
                      updateItem(index, "vat_rate", parseFloat(e.target.value) || 18)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Label htmlFor={`item-${rowId}-promotion`}>
                    Service Promotion Code
                  </Label>
                  <Input
                    id={`item-${rowId}-promotion`}
                    value={item.promotion_code || ""}
                    onChange={(event) =>
                      applyPromotionToRow(index, event.target.value)
                    }
                    placeholder="Optional service discount code"
                    className="font-mono uppercase"
                  />
                </div>

                {item.discount_amount ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <div className="text-muted-foreground">Line discount</div>
                    <div className="font-medium">
                      -€{Number(item.discount_amount).toFixed(2)}
                    </div>
                  </div>
                ) : null}
              </div>

              {item.promotion_summary ? (
                <p className="text-sm text-muted-foreground">
                  {item.promotion_summary}
                </p>
              ) : null}

              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <div className="space-x-4 text-muted-foreground">
                  <span>Subtotal: €{subtotal.toFixed(2)}</span>
                  <span>VAT: €{vatAmount.toFixed(2)}</span>
                  <span className="font-semibold text-foreground">
                    Total: €{total.toFixed(2)}
                  </span>
                </div>

                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
