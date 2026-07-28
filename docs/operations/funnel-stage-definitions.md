# Funnel Stage Definitions

- Inquiry recorded: a lead row exists; every WhatsApp, Facebook, Instagram,
  referral, phone, website, or manual inquiry must be recorded.
- Qualified: eligibility was evaluated and `qualified_at` exists. A
  disqualification has its own outcome, timestamp, and notes.
- Consultation booked: a consultation record with requested/booked status and a
  scheduled start exists.
- Consultation completed: the record is completed with outcome, next action, and
  completion timestamp.
- Offer drafted: a dedicated versioned proposal exists. It is not a contract.
- Offer sent: validity was explicitly chosen and `sent_at` exists.
- Offer accepted/rejected: evidence or reason and the corresponding timestamp
  exist. Sent proposals may also expire or be superseded.
- Converted: accepted lead was converted through existing client/property logic.
  This does not activate a contract.
- Paying customer: the converted client has a positive payment row through an
  existing invoice. `won` alone is never sufficient.

Initial response target is the same business day where reasonably possible;
absolute maximum is the next business day. Overdue follow-up means the current
follow-up date is earlier than today and the relevant step is not closed.

