// Pure identity-resolution decision logic (testable mirror of the SQL
// resolve_contact_identity_whatsapp function, which is authoritative).

export type ResolutionDecision =
  | { outcome: "resolved"; target: "lead"; id: string }
  | { outcome: "resolved"; target: "client"; id: string }
  | { outcome: "needs_review" }
  | { outcome: "unresolved" };

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v) => !!v))];
}

export function decideWhatsAppResolution(input: {
  leadIds: string[];
  clientIds: string[];
}): ResolutionDecision {
  const leads = unique(input.leadIds);
  const clients = unique(input.clientIds);

  if (leads.length === 1 && clients.length === 0) {
    return { outcome: "resolved", target: "lead", id: leads[0] };
  }

  if (clients.length === 1 && leads.length === 0) {
    return { outcome: "resolved", target: "client", id: clients[0] };
  }

  if (leads.length + clients.length > 1) {
    return { outcome: "needs_review" };
  }

  return { outcome: "unresolved" };
}
