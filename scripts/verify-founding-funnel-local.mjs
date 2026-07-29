import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const container = process.env.SUPABASE_DB_CONTAINER || "supabase_db_strehe-app";
const reportFlag = process.argv.indexOf("--report");
const reportPath =
  reportFlag >= 0 && process.argv[reportFlag + 1]
    ? path.resolve(process.argv[reportFlag + 1])
    : null;

const ids = {
  admin: "91000000-0000-0000-0000-000000000001",
  field: "91000000-0000-0000-0000-000000000002",
  campaign: "91000000-0000-0000-0000-000000000010",
  lead1: "91000000-0000-0000-0000-000000000011",
  lead2: "91000000-0000-0000-0000-000000000012",
  lead3: "91000000-0000-0000-0000-000000000013",
  lead4: "91000000-0000-0000-0000-000000000014",
  funnelLead: "91000000-0000-0000-0000-000000000015",
  transitionLead: "91000000-0000-0000-0000-000000000016",
  transitionOffer: "91000000-0000-0000-0000-000000000020",
  client: "91000000-0000-0000-0000-000000000030",
  property: "91000000-0000-0000-0000-000000000031",
  package: "91000000-0000-0000-0000-000000000032",
  subscription: "91000000-0000-0000-0000-000000000033",
  invoice: "91000000-0000-0000-0000-000000000034",
  payment: "91000000-0000-0000-0000-000000000035",
};

const psqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-X",
  "-v",
  "ON_ERROR_STOP=1",
  "-At",
];

function psql(sql) {
  return execFileSync("docker", psqlArgs, {
    encoding: "utf8",
    input: sql,
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

function psqlConcurrent(sql) {
  return new Promise((resolve) => {
    const child = execFile(
      "docker",
      psqlArgs,
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      }
    );
    child.stdin.end(sql);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanup() {
  psql(`
    delete from public.payments where id = '${ids.payment}';
    delete from public.invoices where id = '${ids.invoice}';
    delete from public.subscriptions where id = '${ids.subscription}';
    delete from public.packages where id = '${ids.package}';
    delete from public.properties where id = '${ids.property}';
    update public.leads
      set converted_client_id = null, converted_at = null
      where id = '${ids.funnelLead}';
    delete from public.clients where id = '${ids.client}';
    delete from public.leads where id in (
      '${ids.lead1}', '${ids.lead2}', '${ids.lead3}', '${ids.lead4}',
      '${ids.funnelLead}', '${ids.transitionLead}'
    );
    delete from public.promotion_campaigns where id = '${ids.campaign}';
    delete from public.app_users where id in ('${ids.admin}', '${ids.field}');
    delete from auth.users where id in ('${ids.admin}', '${ids.field}');
  `);
}

const startedAt = new Date().toISOString();
const report = {
  startedAt,
  databaseContainer: container,
  checks: {},
  identifiers: {
    namespace: "91000000-0000-0000-0000-*",
    campaignId: ids.campaign,
    funnelLeadId: ids.funnelLead,
    transitionOfferId: ids.transitionOffer,
  },
};

try {
  cleanup();

  const preexisting = Number(
    psql(`
      select count(*)
      from public.lead_offers
      where founding_customer_eligible
        and status in ('draft', 'sent', 'accepted');
    `)
  );
  assert(preexisting === 0, "Local verification requires zero pre-existing active founding offers.");

  psql(`
    insert into auth.users(id) values ('${ids.admin}'), ('${ids.field}');
    insert into public.app_users(id, role)
    values ('${ids.admin}', 'admin'), ('${ids.field}', 'field');

    insert into public.promotion_campaigns(
      id, name, channel, campaign_status, planned_budget_cents, actual_spend_cents
    ) values (
      '${ids.campaign}', 'STREHE-LAUNCH-003 local verification',
      'local_test', 'completed', 30000, 30000
    );

    insert into public.leads(
      id, full_name, source, source_detail, campaign_id, campaign_name,
      utm_source, utm_medium, utm_campaign, landing_locale, landing_page,
      first_touch_at, qualification_outcome, qualified_at
    ) values
      ('${ids.lead1}', 'Local Test Lead 1', 'website', 'local verification', '${ids.campaign}', 'STREHE-LAUNCH-003 local verification', 'local', 'test', 'launch-003', 'sq', '/sq/contact', now(), 'qualified', now()),
      ('${ids.lead2}', 'Local Test Lead 2', 'website', 'local verification', '${ids.campaign}', 'STREHE-LAUNCH-003 local verification', 'local', 'test', 'launch-003', 'sq', '/sq/contact', now(), 'qualified', now()),
      ('${ids.lead3}', 'Local Test Lead 3', 'website', 'local verification', '${ids.campaign}', 'STREHE-LAUNCH-003 local verification', 'local', 'test', 'launch-003', 'sq', '/sq/contact', now(), 'qualified', now()),
      ('${ids.lead4}', 'Local Test Lead 4', 'website', 'local verification', '${ids.campaign}', 'STREHE-LAUNCH-003 local verification', 'local', 'test', 'launch-003', 'sq', '/sq/contact', now(), 'qualified', now()),
      ('${ids.funnelLead}', 'Local Funnel Customer', 'website', 'local verification', '${ids.campaign}', 'STREHE-LAUNCH-003 local verification', 'local', 'test', 'launch-003', 'sq', '/sq/contact', now(), 'qualified', now()),
      ('${ids.transitionLead}', 'Local Transition Lead', 'website', 'local verification', '${ids.campaign}', 'STREHE-LAUNCH-003 local verification', 'local', 'test', 'launch-003', 'sq', '/sq/contact', now(), 'qualified', now());

    insert into public.lead_offers(
      lead_id, version, status, selected_package, monthly_price_cents,
      founding_customer_eligible, price_lock_months,
      property_service_area_summary, visit_frequency, included_services, exclusions
    ) values
      ('${ids.lead1}', 1, 'draft', 'essential_check', 7500, true, 12, 'Local area 1', 'Monthly', 'Verification services', 'Verification exclusions'),
      ('${ids.lead2}', 1, 'draft', 'essential_check', 7500, true, 12, 'Local area 2', 'Monthly', 'Verification services', 'Verification exclusions');
  `);

  const duplicateOffer = await psqlConcurrent(`
    insert into public.lead_offers(
      lead_id, version, status, selected_package, monthly_price_cents,
      founding_customer_eligible, price_lock_months,
      property_service_area_summary, visit_frequency, included_services, exclusions
    ) values (
      '${ids.lead1}', 2, 'sent', 'essential_check', 7500,
      true, 12, 'Duplicate local area', 'Monthly',
      'Verification services', 'Verification exclusions'
    );
  `);
  assert(
    !duplicateOffer.ok &&
      duplicateOffer.stderr.includes("idx_lead_offers_one_active_founding_per_lead"),
    "A second active founding offer for one lead must be rejected."
  );

  const offerInsert = (leadId) => `
    select pg_sleep(0.25);
    insert into public.lead_offers(
      lead_id, version, status, selected_package, monthly_price_cents,
      founding_customer_eligible, price_lock_months,
      property_service_area_summary, visit_frequency, included_services, exclusions
    ) values (
      '${leadId}', 1, 'draft', 'essential_check', 7500,
      true, 12, 'Concurrent local area', 'Monthly',
      'Verification services', 'Verification exclusions'
    ) returning id;
  `;
  const capacityRace = await Promise.all([
    psqlConcurrent(offerInsert(ids.lead3)),
    psqlConcurrent(offerInsert(ids.lead4)),
  ]);
  assert(
    capacityRace.filter((result) => result.ok).length === 1,
    "Exactly one concurrent founding offer must reserve the final place."
  );
  assert(
    capacityRace.filter((result) => !result.ok).length === 1 &&
      capacityRace.some((result) =>
        result.stderr.includes("Founding-customer capacity is limited to three active places.")
      ),
    "The losing founding offer must fail with the capacity error."
  );

  const capacityState = psql(`
    select reserved_places || '|' || maximum_places || '|' || (
      select count(*)
      from public.lead_offers
      where founding_customer_eligible
        and status in ('draft', 'sent', 'accepted')
    )
    from public.founding_customer_capacity
    where singleton;
  `);
  assert(capacityState === "3|3|3", `Unexpected founding capacity state: ${capacityState}`);

  report.checks.foundingCapacity = {
    passed: true,
    concurrentWinners: 1,
    concurrentLosers: 1,
    capacityState,
    duplicateActiveOfferRejected: true,
  };

  psql(`
    insert into public.lead_offers(
      id, lead_id, version, status, selected_package, monthly_price_cents,
      founding_customer_eligible, price_lock_months,
      property_service_area_summary, visit_frequency, included_services, exclusions,
      valid_until, sent_at
    ) values (
      '${ids.transitionOffer}', '${ids.transitionLead}', 1, 'sent',
      'essential_check', 7500, false, null, 'Transition local area',
      'Monthly', 'Verification services', 'Verification exclusions',
      current_date + 14, now()
    );
  `);

  const transitionSql = `
    begin;
    select pg_sleep(0.25);
    with transitioned as (
      update public.lead_offers
      set status = 'accepted', accepted_at = now(), updated_at = now()
      where id = '${ids.transitionOffer}' and status = 'sent'
      returning id, lead_id
    )
    insert into public.lead_events(lead_id, event_type, summary, metadata)
    select lead_id, 'offer_accepted', 'Concurrent local transition winner',
      jsonb_build_object('offer_id', id)
    from transitioned
    returning id;
    commit;
  `;
  const transitionRace = await Promise.all([
    psqlConcurrent(transitionSql),
    psqlConcurrent(transitionSql),
  ]);
  assert(
    transitionRace.every((result) => result.ok),
    "Both conditional transition transactions must complete without a database error."
  );
  const transitionState = psql(`
    select status || '|' || (
      select count(*)
      from public.lead_events
      where metadata ->> 'offer_id' = '${ids.transitionOffer}'
        and event_type = 'offer_accepted'
    )
    from public.lead_offers
    where id = '${ids.transitionOffer}';
  `);
  assert(
    transitionState === "accepted|1",
    `Concurrent transition produced unexpected state: ${transitionState}`
  );
  report.checks.transitionConcurrency = {
    passed: true,
    concurrentAttempts: 2,
    acceptedRows: 1,
    emittedEvents: 1,
  };

  psql(`
    insert into public.lead_consultations(
      lead_id, scheduled_start, contact_format, status, property_location,
      property_count, recommended_package, outcome, completed_at
    ) values (
      '${ids.funnelLead}', now(), 'whatsapp_video', 'completed', 'Prishtinë',
      1, 'essential_check', 'Proceed to offer', now()
    );

    insert into public.lead_offers(
      lead_id, version, status, selected_package, monthly_price_cents,
      founding_customer_eligible, price_lock_months,
      property_service_area_summary, visit_frequency, included_services, exclusions,
      valid_until, sent_at, accepted_at
    ) values (
      '${ids.funnelLead}', 1, 'accepted', 'essential_check', 7500,
      false, null, 'Apartment in Prishtinë', 'Monthly',
      'Verification services', 'Verification exclusions',
      current_date + 14, now(), now()
    );

    insert into public.clients(id, client_type, full_name)
    values ('${ids.client}', 'individual', 'Local Funnel Customer');

    insert into public.properties(
      id, property_type, address_line_1, city, owner_client_id, title
    ) values (
      '${ids.property}', 'apartment', 'Local verification address',
      'Prishtinë', '${ids.client}', 'Local verification property'
    );

    insert into public.packages(id, name)
    values ('${ids.package}', 'Local Essential Check');

    insert into public.subscriptions(
      id, package_id, status, start_date, client_id, property_id, monthly_price
    ) values (
      '${ids.subscription}', '${ids.package}', 'active', current_date,
      '${ids.client}', '${ids.property}', 75.00
    );

    update public.leads
    set consultation_scheduled_at = now(),
        consultation_status = 'completed',
        consultation_completed_at = now(),
        recommended_package = 'essential_check',
        offer_drafted_at = now(),
        current_offer_status = 'accepted',
        offer_sent_at = now(),
        offer_accepted_at = now(),
        converted_client_id = '${ids.client}',
        converted_at = now()
    where id = '${ids.funnelLead}';

    insert into public.invoices(
      id, due_date, status, subtotal_cents, total_cents, user_id,
      vat_amount_cents, vat_rate, client_id, property_id, subscription_id
    ) values (
      '${ids.invoice}', current_date + 14, 'sent', 7500, 7500, '${ids.admin}',
      0, 0, '${ids.client}', '${ids.property}', '${ids.subscription}'
    );

    insert into public.payments(id, payment_method, amount_cents, invoice_id)
    values ('${ids.payment}', 'cash', 7500, '${ids.invoice}');
  `);

  const funnelState = psql(`
    with campaign_leads as (
      select *
      from public.leads
      where campaign_id = '${ids.campaign}'
    ),
    paying_clients as (
      select distinct i.client_id
      from public.payments p
      join public.invoices i on i.id = p.invoice_id
      where p.amount_cents > 0
        and i.client_id is not null
    )
    select
      count(*) || '|' ||
      count(*) filter (where qualified_at is not null) || '|' ||
      count(*) filter (where consultation_completed_at is not null) || '|' ||
      count(*) filter (where offer_accepted_at is not null) || '|' ||
      count(*) filter (
        where converted_client_id in (select client_id from paying_clients)
      ) || '|' ||
      (
        select actual_spend_cents
        from public.promotion_campaigns
        where id = '${ids.campaign}'
      )
    from campaign_leads;
  `);
  assert(funnelState === "6|6|1|1|1|30000", `Unexpected funnel state: ${funnelState}`);
  report.checks.inquiryToPayment = {
    passed: true,
    campaignFunnel: {
      inquiries: 6,
      qualifiedLeads: 6,
      completedConsultations: 1,
      acceptedOffers: 1,
      paymentBackedCustomers: 1,
      actualSpendCents: 30000,
      customerAcquisitionCostCents: 30000,
    },
  };

  const adminVisible = Number(
    psql(`
      begin;
      set local role authenticated;
      set local request.jwt.claim.sub = '${ids.admin}';
      select count(*) from public.lead_offers where lead_id = '${ids.funnelLead}';
      rollback;
    `)
      .split(/\r?\n/)
      .find((line) => /^\d+$/.test(line)) || "-1"
  );
  const fieldVisible = Number(
    psql(`
      begin;
      set local role authenticated;
      set local request.jwt.claim.sub = '${ids.field}';
      select count(*) from public.lead_offers where lead_id = '${ids.funnelLead}';
      rollback;
    `)
      .split(/\r?\n/)
      .find((line) => /^\d+$/.test(line)) || "-1"
  );
  assert(adminVisible === 1, "Active admin must be able to read the local test offer.");
  assert(fieldVisible === 0, "Field user must not be able to read internal offers.");
  report.checks.rls = {
    passed: true,
    adminOfferRows: adminVisible,
    fieldOfferRows: fieldVisible,
    anonymousPolicies: Number(
      psql(`
        select count(*)
        from pg_policies
        where schemaname = 'public'
          and tablename in ('lead_consultations', 'lead_offers')
          and 'anon' = any(roles);
      `)
    ),
  };
  assert(report.checks.rls.anonymousPolicies === 0, "Funnel tables must have no anonymous policy.");
} finally {
  try {
    cleanup();
    report.cleanup = { passed: true };
  } catch (error) {
    report.cleanup = { passed: false, error: String(error) };
  }
}

report.finishedAt = new Date().toISOString();
report.passed =
  Object.values(report.checks).every((check) => check.passed) &&
  report.cleanup.passed;

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (reportPath) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, serialized, "utf8");
}
process.stdout.write(serialized);
if (!report.passed) process.exitCode = 1;
