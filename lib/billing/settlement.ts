// lib/billing/settlement.ts

export type InvoiceSettlementStatus = "draft" | "issued" | "paid" | "cancelled";

export type SettlementInput = {
  totalCents: number | null | undefined;
  paymentsCents: number | null | undefined;
  issuedCreditNotesCents: number | null | undefined;
};

export type SettlementResult = {
  totalCents: number;
  paymentsCents: number;
  issuedCreditNotesCents: number;
  remainingCents: number;
  isSettled: boolean;
};

const TOLERANCE_CENTS = 1; // abs(remaining) < 0.01 EUR => treat as 0

function safeCents(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function computeSettlement(input: SettlementInput): SettlementResult {
  const totalCents = safeCents(input.totalCents);
  const paymentsCents = safeCents(input.paymentsCents);
  const issuedCreditNotesCents = safeCents(input.issuedCreditNotesCents);

  let remainingCents =
    totalCents - paymentsCents - issuedCreditNotesCents;

  if (Math.abs(remainingCents) <= TOLERANCE_CENTS) {
    remainingCents = 0;
  }

  if (remainingCents < 0) {
    remainingCents = 0;
  }

  return {
    totalCents,
    paymentsCents,
    issuedCreditNotesCents,
    remainingCents,
    isSettled: remainingCents === 0,
  };
}

export function sumAmountCents<T extends { amount_cents?: number | null }>(
  rows: T[] | null | undefined
) {
  return (rows || []).reduce(
    (sum, row) => sum + safeCents(row.amount_cents),
    0
  );
}

export function sumIssuedCreditNoteCents<
  T extends { status?: string | null; total_cents?: number | null }
>(rows: T[] | null | undefined) {
  return (rows || []).reduce((sum, row) => {
    if (row.status !== "issued") return sum;
    return sum + safeCents(row.total_cents);
  }, 0);
}