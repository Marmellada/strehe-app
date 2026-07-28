export type OfferStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "superseded";

const transitions: Record<OfferStatus, readonly OfferStatus[]> = {
  draft: ["sent", "superseded"],
  sent: ["accepted", "rejected", "expired", "superseded"],
  accepted: [],
  rejected: [],
  expired: [],
  superseded: [],
};

export function assertOfferTransition(from: OfferStatus, to: OfferStatus) {
  if (!transitions[from].includes(to)) {
    throw new Error(`Offer cannot move from ${from} to ${to}.`);
  }
}

export function assertOfferCanBeSent(input: {
  validUntil: string | null;
  sentAt?: Date;
}) {
  if (!input.validUntil) {
    throw new Error("Choose an offer-valid-until date before sending.");
  }
  const validUntil = new Date(`${input.validUntil}T23:59:59Z`);
  if (Number.isNaN(validUntil.getTime()) || validUntil < (input.sentAt || new Date())) {
    throw new Error("Offer validity must end in the future.");
  }
}

