"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { computeLineItemTotal } from "@/lib/billing-helpers";
import type { LineItemInput } from "@/lib/validations/billing";


interface LineItemsEditorProps {
  items: LineItemInput[];
  onChange: (items: LineItemInput[]) => void;
  errors?: Record<string, string[]>;
}

export function LineItemsEditor({ items, onChange, errors }: LineItemsEditorProps) {
  const addItem = () => {
    onChange([
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 18,
        temp_id: Math.random().toString(36).substr(2, 9),
      },
    ]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItemInput, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
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

      {errors?.items && (
        <p className="text-sm text-red-600">{errors.items[0]}</p>
      )}

      <div className="space-y-3">
        {items.map((item, index) => {
          const { subtotal, vatAmount, total } = computeLineItemTotal(
            item.quantity,
            item.unit_price,
            item.vat_rate
          );

          return (
            <div key={item.temp_id || index} className="p-4 border rounded-lg space-y-3">
              {/* Description */}
              <div>
                <Label htmlFor={`item-${index}-description`}>Description</Label>
                <Input
                  id={`item-${index}-description`}
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                  placeholder="E.g., Monthly rent for Apartment 3B"
                />
              </div>

              {/* Quantity, Unit Price, VAT Rate */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor={`item-${index}-quantity`}>Quantity</Label>
                  <Input
                    id={`item-${index}-quantity`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor={`item-${index}-unit-price`}>Unit Price (€)</Label>
                  <Input
                    id={`item-${index}-unit-price`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor={`item-${index}-vat-rate`}>VAT (%)</Label>
                  <Input
                    id={`item-${index}-vat-rate`}
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

              {/* Totals Preview */}
              <div className="flex items-center justify-between pt-2 border-t text-sm">
                <div className="space-x-4 text-gray-600">
                  <span>Subtotal: €{subtotal.toFixed(2)}</span>
                  <span>VAT: €{vatAmount.toFixed(2)}</span>
                  <span className="font-semibold text-gray-900">Total: €{total.toFixed(2)}</span>
                </div>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
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
