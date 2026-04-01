import type { LineItemInput } from "./validations/billing";

export function computeLineItemTotal(
  quantity: number,
  unitPrice: number,
  vatRate: number
): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = quantity * unitPrice;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    vatAmount: parseFloat(vatAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

export function computeInvoiceTotals(items: LineItemInput[]): {
  subtotal: number;
  totalVat: number;
  total: number;
} {
  const result = items.reduce(
    (acc, item) => {
      const lineTotal = computeLineItemTotal(
        item.quantity,
        item.unit_price,
        item.vat_rate
      );
      return {
        subtotal: acc.subtotal + lineTotal.subtotal,
        totalVat: acc.totalVat + lineTotal.vatAmount,
        total: acc.total + lineTotal.total,
      };
    },
    { subtotal: 0, totalVat: 0, total: 0 }
  );

  return {
    subtotal: parseFloat(result.subtotal.toFixed(2)),
    totalVat: parseFloat(result.totalVat.toFixed(2)),
    total: parseFloat(result.total.toFixed(2)),
  };
}
