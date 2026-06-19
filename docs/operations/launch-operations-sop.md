# STREHE Launch Operations SOP

## Purpose

This is the v1 operating procedure for apartment care before launch. It keeps the service simple enough to run solo while still giving clients a repeatable, trustworthy process.

Scope:

- lead/CRM intake and qualification
- contract setup
- billing, payments, and finance review
- monthly operations review
- client communication and complaint handling
- key storage and handover
- visit checklist
- photo report template
- client onboarding
- urgent issue handling
- technician coordination
- privacy/photo handling
- staff access and deployment discipline

CRM-lite is now part of launch. Use it for website, WhatsApp, referral, phone, and manual leads so follow-ups do not live only in memory or chat threads.

---

## 1. Key Handling SOP

### Storage Method

Use one locked physical key cabinet or lockbox in the STREHE office/home-office base for launch.

Rules:

- only STREHE admin/operator has cabinet access at launch
- cabinet stays locked when not actively adding/removing a key
- keys are never labeled with full client names, phone numbers, or full addresses
- every key must exist in the app before it is stored

### Label Format

Use this physical label format:

```text
STH-[PROPERTY_CODE]-[KEY_NUMBER]
```

Example:

```text
STH-PR-0007-K1
```

If the property code is unavailable, use the app key tag until the property code is confirmed.

Allowed label contents:

- property code
- key number
- optional cabinet slot

Not allowed:

- owner name
- apartment address
- phone number
- WhatsApp contact

### Handover Process

When receiving keys from a client or trusted contact:

1. Confirm property and owner in the app.
2. Create the key record from the property page.
3. Add key type, key tag, and storage location.
4. Mark status as available.
5. Add a note with received date, received from, and count.
6. Store the key in the cabinet immediately.
7. Send client confirmation that keys were received and registered.

Minimum handover note:

```text
Received [count] key(s) from [name/contact] on [date]. Stored as [key tag].
```

### Checkout / Use Process

Before a visit:

1. Open the key record.
2. Assign the key to the operator/technician who will use it.
3. Add expected return date/time in notes if needed.
4. Carry only the key needed for the visit.
5. Never leave the key with a third party unless the client explicitly approved it.

### Return Process

After the visit:

1. Return the key to the cabinet the same day whenever possible.
2. Mark the key as returned/available in the app.
3. Add a short return note.
4. If the key is not returned the same day, add a reason and next expected return time.

Minimum return note:

```text
Returned to cabinet on [date/time] after [visit/task].
```

### Lost Or Damaged Key

If a key is lost, damaged, or temporarily unaccounted for:

1. Mark the key status immediately.
2. Notify the client.
3. Record what happened in the key log.
4. Decide whether lock replacement or duplicate key creation is needed.
5. Link any related task or expense in the app.

---

## 2. Visit Checklist

Use this checklist for every apartment-care visit.

### Before Arrival

- Confirm task, property, access instructions, and key availability.
- Check if there are client notes or urgent warnings.
- Take only required keys.
- Confirm phone battery and photo storage.

### On Arrival

- Verify the correct building/unit before entering.
- Check door and lock condition.
- Take entry photo only if appropriate and non-sensitive.
- Note unusual smells, sounds, water, electricity, or visible damage.

### Inside Apartment

Check:

- entrance and hallway
- windows and balcony doors
- water leaks under sinks and around bathroom/kitchen
- visible mold or humidity
- electricity/main switches if relevant
- heating/cooling if relevant
- appliances if included in service
- signs of pests
- mail or notices if accessible
- general cleanliness and security

### Before Leaving

- Close windows and balcony doors.
- Turn off lights/water/appliances as appropriate.
- Lock the door.
- Confirm key is back in possession.
- Add visit notes and photos to the task report.

---

## 3. Photo Report Template

Every completed visit should produce a clear task report.

### Required Report Structure

```text
Visit date:
Property:
Access/key status:

Summary:
- [short plain-language summary]

Checked:
- entrance/door/lock
- windows/balcony
- kitchen/water
- bathroom/water
- electricity/appliances
- general condition

Issues found:
- [none / issue details]

Actions taken:
- [none / action details]

Recommended next step:
- [none / client decision / technician / follow-up visit]
```

### Photo Rules

- Include useful proof, not random photos.
- Avoid personal documents, family photos, valuables, and private items unless needed to document an issue.
- Photograph problems from one wide angle and one close angle.
- Do not post or reuse client photos for marketing without explicit approval.

---

## 4. Client Onboarding Checklist

Before activating a client/property:

1. Create client record.
2. Create property record with municipality, neighborhood/village, and address.
3. Confirm owner relationship.
4. Add key records and receive physical keys.
5. Create package/contract.
6. Confirm physical contract is signed and filed.
7. Confirm communication channel, usually WhatsApp.
8. Confirm emergency contact.
9. Confirm what STREHE may and may not do without approval.
10. Confirm invoice/payment method.

Minimum client onboarding note:

```text
Client onboarded on [date]. Communication via [channel]. Emergency contact: [name/phone]. Keys registered: [yes/no]. Contract active: [yes/no].
```

---

## 5. Urgent Issue Procedure

Urgent issues include:

- active water leak
- electrical danger
- forced entry or suspected break-in
- fire/smoke signs
- serious mold/humidity risk
- blocked access that prevents securing the apartment

Process:

1. Make the situation safe if it can be done without personal risk.
2. Take evidence photos/video.
3. Call/message the client immediately.
4. Create or escalate the task in the app.
5. If a technician is needed, follow the technician coordination process.
6. Record all decisions and approvals in the task report.

Decision rule:

- If the issue threatens property damage or safety, contact the client immediately.
- If the client cannot respond and delay creates damage risk, take the minimum reasonable action to prevent further damage and document it.

---

## 6. Technician Coordination Procedure

Use technicians for repairs, diagnostics, and specialized work outside normal visit scope.

Process:

1. Document the issue with photos and notes.
2. Ask client for approval unless it is an emergency damage-prevention case.
3. Contact approved technician/vendor.
4. Record expected cost range if available.
5. Create or update the task with technician details.
6. If STREHE pays first, create an expense entry and keep receipt proof.
7. Send client the result and next recommendation.

Technician note template:

```text
Technician:
Issue:
Client approval:
Expected cost:
Visit/repair date:
Result:
Receipt/expense:
Next step:
```

---

## 7. Lead / CRM Intake SOP

Use CRM leads for every real inquiry that may become a client.

Lead sources:

- website contact form
- WhatsApp
- phone call
- referral
- Instagram/Facebook
- manual founder/operator entry

### Intake Process

1. Create or find the lead in `/leads`.
2. Set source, preferred contact method, priority, service interest, and estimated monthly value if known.
3. Add phone/email and city/location.
4. Add the first note with what the person asked for.
5. Set next follow-up date before leaving the lead.
6. Assign the lead to the responsible user when more than one person is working.

Minimum first note:

```text
Lead came from [source] on [date]. Asked about [need]. Preferred contact: [WhatsApp/phone/email]. Next step: [call/send info/book onboarding].
```

### Follow-Up Rules

- Hot/high-priority lead: follow up same day.
- Interested lead: follow up within 1 business day.
- Waiting lead: set a clear next follow-up date.
- Lost lead: mark lost and add the reason.
- Do not leave open leads without a next follow-up unless they are converted or lost.

### Conversion Rule

Convert a lead to client only when:

- identity/contact details are clear
- property location is roughly known
- the person has a real need for apartment care
- next onboarding step is agreed

After conversion, continue with the client onboarding checklist.

---

## 8. Client Qualification SOP

Before accepting a client, confirm the work is realistic and safe for STREHE.

Qualification questions:

1. Where is the apartment?
2. Who owns or controls access to it?
3. Is anyone living in it now?
4. What should STREHE check during visits?
5. Are there known risks: leaks, electricity, humidity, difficult neighbors, building access problems?
6. Who can approve urgent repairs?
7. Who pays invoices and how?
8. Are keys available and how will they be handed over?

Accept the client when:

- the property is inside the launch service area
- access can be handled safely
- the client accepts the package scope and limits
- invoice/payment expectations are clear
- key handling rules are accepted

Pause or reject the client when:

- ownership/authorization is unclear
- access is unsafe or unreliable
- the client expects legal, tenant, construction, or emergency-response services outside scope
- payment expectations are unclear
- the apartment condition creates unreasonable risk before inspection

Minimum qualification note:

```text
Qualified on [date]. Location: [area]. Access: [keys/contact/building]. Main need: [need]. Risks: [none/details]. Accepted for onboarding: [yes/no].
```

---

## 9. Contract Setup SOP

Use this before activating a recurring service contract.

Process:

1. Confirm client record is complete.
2. Confirm property record is complete.
3. Confirm package and included service expectations.
4. Apply promotion code only if it is valid and agreed.
5. Create the contract in draft/prepared state.
6. Generate/open the contract PDF and review details.
7. Send contract to client for confirmation/signature.
8. Confirm signed/accepted copy is filed.
9. Activate the contract only after signature/acceptance is confirmed.
10. Add notes for any special approvals or package exceptions.

Contract must show:

- client and company
- property
- package
- start date
- price and discount if any
- included services
- agreement terms
- signature/date/place

Minimum contract note:

```text
Contract prepared on [date]. Package: [package]. Price: [amount]. Discount: [none/code]. Sent to client: [yes/no]. Signed/accepted: [yes/no].
```

---

## 10. Billing And Payment SOP

Use the billing module for invoices, payments, credit notes, and invoice PDF records.

### Invoice Creation

Create an invoice when:

- a monthly package fee is due
- an approved add-on is completed or ready to bill
- STREHE paid an approved expense that must be recharged

Before issuing:

1. Confirm client and property.
2. Confirm line item description is clear.
3. Confirm VAT behavior.
4. Confirm discount/promotion if used.
5. Confirm company bank details appear on the invoice.
6. Open the PDF and check basic layout.

### Payment Recording

When payment is received:

1. Open the invoice.
2. Record payment date, method, account, amount, and reference if available.
3. Confirm invoice status updated.
4. Keep proof of payment when available.

### Unpaid Invoice Follow-Up

- 1-3 days overdue: friendly reminder.
- 7 days overdue: direct reminder with invoice number.
- 14+ days overdue: pause non-urgent add-ons until payment plan is clear.

### Credit Note Rule

Use a credit note only when:

- invoice was issued incorrectly
- client receives an approved discount/refund
- service/line item must be reduced after issuing

Minimum payment note:

```text
Payment recorded on [date]. Amount: [amount]. Method/account: [method]. Reference: [reference/none].
```

---

## 11. Monthly Operations Review SOP

Do this at least once per week during launch, and monthly once operations stabilize.

Review:

1. Upcoming visits/tasks for the next 7 days.
2. Overdue tasks.
3. Missing task reports.
4. Open urgent issues.
5. Keys currently assigned or not returned.
6. Open leads and due follow-ups.
7. Draft/issued/unpaid invoices.
8. New expenses.
9. Contracts starting, ending, paused, or cancelled.

Minimum weekly review note:

```text
Weekly review [date]. Overdue tasks: [count]. Open leads due: [count]. Unpaid invoices: [count]. Key exceptions: [none/details]. Main action: [action].
```

---

## 12. Client Communication SOP

Default communication channel at launch is WhatsApp, unless the client prefers phone or email.

Tone:

- clear
- calm
- short
- factual
- no overpromising

Rules:

- Important approvals must be written in the app notes/task report, even if agreed on WhatsApp.
- Do not promise repair cost, completion date, or third-party availability before technician confirmation.
- Send visit summaries in plain language.
- Keep sensitive details out of public/social channels.
- If a client complains, create/update the related task or lead/client note.

Useful message structure:

```text
Hello [name], quick update from STREHE:

Property:
What we checked:
Issue found:
Next recommendation:
```

Approval message structure:

```text
Please confirm if you approve [action] with estimated cost [amount/range]. We will proceed only after your approval unless this is an urgent damage-prevention situation.
```

---

## 13. Complaint / Service Issue SOP

Use this when the client says something is wrong, unclear, late, missing, or unsatisfactory.

Complaint examples:

- visit was late or missed
- report was unclear
- photos were missing or not useful
- key/access concern
- technician problem
- invoice/payment dispute

Process:

1. Acknowledge the complaint calmly.
2. Find the related client, property, task, invoice, or key record.
3. Record the complaint in notes or task report.
4. Check facts before giving a final answer.
5. Decide correction: resend report, revisit, credit note, technician follow-up, or explanation.
6. Tell the client the next step and expected timing.
7. Close only after the client response or corrective action is recorded.

Minimum complaint note:

```text
Complaint received on [date] via [channel]. Topic: [issue]. Record checked: [task/invoice/key]. Decision: [action]. Client informed: [yes/no].
```

---

## 14. Vendor / Technician Approval SOP

Use this before a technician or vendor is used for client property work.

Before first use:

1. Create vendor record.
2. Add contact person, phone, service type, and notes.
3. Confirm whether they can issue receipt/invoice.
4. Confirm basic reliability from experience/referral.
5. Mark vendor active only if usable.

Before property access:

1. Confirm client approval unless urgent damage prevention applies.
2. Confirm who will meet/open the property.
3. Confirm expected cost/range.
4. Create/update task.
5. Do not give keys directly unless explicitly approved and recorded.

After work:

1. Collect proof/photo/receipt.
2. Add result to task.
3. Create expense if STREHE paid.
4. Tell client what was done and what remains.

---

## 15. Privacy And Photo Handling SOP

This is launch-critical because STREHE enters private homes.

Rules:

- Photograph only what supports the visit report or issue.
- Avoid personal documents, medicine, children/family photos, valuables, IDs, bank letters, and private screens.
- If a sensitive item must be documented because it is related to a problem, keep the photo private and describe why it was taken.
- Do not reuse client photos for marketing without explicit written approval.
- Do not send photos to technicians unless they need them to assess the issue.
- Do not post property interiors publicly.

Photo retention:

- Keep operational photos attached to task reports.
- Delete duplicate/accidental sensitive photos from personal phone storage after upload.
- Use the app as the source of truth, not phone gallery or chat history.

Minimum privacy note for sensitive photo:

```text
Sensitive photo taken because [reason]. Shared with: [client/technician/none]. Stored only in task report.
```

---

## 16. Staff Access Control SOP

Use this for app users and role changes.

### Launch Role Names

The app role names stay:

- admin
- office
- field
- contractor

Do not add more roles before launch unless a real permission problem appears.

### Role Expectations

Admin:

- owns settings, users, banking, packages, services, contracts, billing, and all operational records
- should be limited to the founder/operator at launch

Office:

- handles day-to-day operations, clients, properties, tasks, keys, expenses, billing, payments, and finance review
- should not manage users, banking settings, or high-level system settings

Field:

- handles assigned visits, task status, task reports, photos, and key usage
- should not manage billing, contracts, packages, services, users, or banking

Contractor:

- handles only assigned work when external help is needed
- should receive the minimum access needed for that task

### First Staff Onboarding

Before giving someone app access:

1. Decide the minimum role they need.
2. Create the user in `/settings/users`.
3. Confirm they can sign in.
4. Show them only the workflows they need.
5. Explain key handling if they will touch keys.
6. Explain photo privacy rules if they will submit reports.
7. Assign one test or real task and confirm they can update it correctly.
8. Deactivate access immediately when the person stops working with STREHE.

Minimum onboarding note:

```text
User onboarded on [date]. Role: [role]. Workflows shown: [tasks/keys/reports/etc]. Key access: [yes/no]. Photo privacy explained: [yes/no].
```

### Offboarding

When someone stops working with STREHE:

1. Deactivate the user.
2. Check assigned tasks.
3. Check any assigned keys.
4. Reassign work.
5. Confirm they no longer have client photos/files locally if applicable.

---

## 17. Finance Review SOP

Do this monthly, or more often while launching.

Review:

- invoices created
- invoices issued
- invoices paid
- unpaid invoices
- credit notes
- expenses by category
- vendor expenses
- bank/cash account records
- finance overview totals

Process:

1. Open finance overview.
2. Check paid invoice totals against bank/cash records.
3. Check expenses are categorized.
4. Review unpaid invoices and decide follow-up.
5. Review any credit notes and reason.
6. Save a short monthly finance note.

Minimum monthly finance note:

```text
Finance review [month]. Revenue paid: [amount]. Unpaid: [amount/count]. Expenses: [amount]. Issues: [none/details]. Next action: [action].
```

---

## 18. Backup / Deployment SOP

Use this when deploying, changing environment variables, or applying database migrations.

Before deployment:

1. Confirm git worktree is clean or expected changes are committed.
2. Run focused smoke tests for changed area.
3. Run build.
4. Confirm `.env.local` is not committed.
5. Keep a note of any Supabase migration applied manually in `docs/operations/supabase-migration-log.md`.

Deployment checks:

1. Confirm Vercel env vars are set.
2. Confirm Supabase URL/key values are correct.
3. Confirm service role key is server-only.
4. Confirm production build succeeds.
5. Check runtime logs after deploy.
6. Test login, dashboard, public website, contact form, and one CRM lead.

Cron setup stays for deployment week:

- configure Vercel cron
- set `CRON_SECRET`
- test `/api/cron/generate-tasks` in production

Minimum deployment note:

```text
Deploy [date]. Commit: [hash]. Build: [pass/fail]. Smoke: [pass/fail]. Env changes: [none/details]. Migration: [none/details].
```

---

## 19. Quality Review SOP

Use this to keep service quality consistent without heavy paperwork.

Weekly during launch, review a small sample:

- 2 completed visit reports
- 1 key log
- 1 invoice/payment record
- all urgent issues
- all overdue tasks
- all due lead follow-ups

Check:

- report summary is clear
- useful photos exist
- privacy rules were respected
- issue recommendations are clear
- key logs make sense
- client communication is recorded
- invoice/payment status is correct

Minimum quality note:

```text
Quality review [date]. Reports checked: [count]. Key logs checked: [count]. Issues found: [none/details]. Correction needed: [yes/no/action].
```

---

## 20. Launch Limits

Until launch proves demand and workload:

- one operator can handle visits and admin work
- contractors/technicians are used only when specific work requires them
- no key cabinet slot UI is needed
- no client portal is needed
- CRM-lite is enough for launch; do not build full WhatsApp Business API integration until lead volume proves it is worth the setup and approval work
- keep paperwork lightweight: if a process does not protect trust, money, access, privacy, or quality, do not add it yet

---
