export type PaymentEvidence = {
  amount_cents: number | null;
  payment_date: string | null;
  invoice?: { client_id?: string | null } | null;
};

export function firstPaymentForClient(
  clientId: string | null | undefined,
  payments: PaymentEvidence[]
) {
  if (!clientId) return null;
  const dates = payments
    .filter(
      (payment) =>
        (payment.amount_cents || 0) > 0 &&
        payment.invoice?.client_id === clientId &&
        payment.payment_date
    )
    .map((payment) => payment.payment_date as string)
    .sort();
  return dates[0] || null;
}
