import { expect, test } from "@playwright/test";
import { execFile, execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeAttribution } from "@/lib/funnel/attribution";
import { assertFoundingCapacity, FOUNDING_PACKAGES, getCommercialStage, safeCost } from "@/lib/funnel/definitions";
import { firstPaymentForClient } from "@/lib/funnel/paying-customer";
import { campaignCosts, countFunnel, type FunnelLead } from "@/lib/funnel/reporting";
import { assertOfferCanBeSent, assertOfferTransition } from "@/lib/funnel/transitions";
import { generateOfferPdf } from "@/lib/funnel/offer-pdf";

test("normalizes and bounds first-touch attribution", () => {
  expect(normalizeAttribution({
    source_detail: "  Facebook   DM ",
    campaign_name: "strehe_meta_diaspora_founders_202608",
    utm_source: " META ",
    utm_medium: "paid_social",
    utm_campaign: " founders ",
    utm_content: "video_a",
    utm_term: "",
    click_id: "abc-123",
    landing_locale: "sq",
    landing_page: "/sq/contact?utm_source=meta",
  })).toMatchObject({ source_detail: "Facebook DM", utm_source: "META", utm_term: null });
  expect(() => normalizeAttribution({
    source_detail: "<script>",
    campaign_name: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    click_id: "",
    landing_locale: "sq",
    landing_page: "",
  })).toThrow();
});

test("commercial stage requires payment evidence for paying customer", () => {
  expect(getCommercialStage({ created_at: "2026-01-01", converted_client_id: "c1" })).toBe("customer_converted");
  expect(getCommercialStage({ created_at: "2026-01-01", converted_client_id: "c1", first_payment_at: "2026-02-01" })).toBe("paying_customer");
  expect(firstPaymentForClient("c1", [
    { amount_cents: 0, payment_date: "2026-01-01", invoice: { client_id: "c1" } },
    { amount_cents: 7500, payment_date: "2026-02-01", invoice: { client_id: "c1" } },
  ])).toBe("2026-02-01");
});

test("offer lifecycle rejects invalid transitions and missing validity", () => {
  expect(() => assertOfferTransition("draft", "accepted")).toThrow();
  expect(() => assertOfferTransition("sent", "accepted")).not.toThrow();
  expect(() => assertOfferCanBeSent({ validUntil: null })).toThrow();
  expect(() => assertOfferCanBeSent({ validUntil: "2030-01-01", sentAt: new Date("2026-01-01") })).not.toThrow();
  expect(() => assertFoundingCapacity(2)).not.toThrow();
  expect(() => assertFoundingCapacity(3)).toThrow();
});

test("campaign funnel metrics handle zero denominators and payment-backed CAC", () => {
  const lead: FunnelLead = {
    id: "l1", created_at: "2026-01-01", source: "website", source_detail: "landing",
    campaign_id: "campaign", campaign_name: "strehe_meta_diaspora_founders_202608",
    recommended_package: "essential_check", qualified_at: "2026-01-02",
    consultation_scheduled_at: "2026-01-03", consultation_completed_at: "2026-01-04",
    offer_sent_at: "2026-01-05", offer_accepted_at: "2026-01-06", converted_client_id: "c1",
  };
  const counts = countFunnel([lead], new Set(["c1"]));
  expect(counts.payingCustomers).toBe(1);
  expect(campaignCosts(10000, counts).customerAcquisitionCost).toBe(10000);
  expect(safeCost(10000, 0)).toBeNull();
});

test("generates an Albanian proposal PDF with term-aware pricing and Home Refresh", async () => {
  const pkg = FOUNDING_PACKAGES.essential_check;
  const result = await generateOfferPdf({
    offer_number: "STH-OFR-2026-0001", version: 1, selected_package: "essential_check",
    selected_term_months: 6, term_total_cents: pkg.termPrices[6],
    founding_customer_eligible: true,
    price_lock_statement: "Çmimi fiksohet për 12 muaj.", property_service_area_summary: "Apartament në Prishtinë",
    visit_frequency: pkg.visits, included_services: pkg.included, exclusions: "Kontraktorët dhe materialet veç.",
    normal_approval_limit_cents: 10000, emergency_limit_cents: 30000,
    proposed_start_date: "2026-08-15", valid_until: "2026-08-10",
    consultation_summary: "Nevojat u konfirmuan.", additional_agreed_items: null,
    lead: { full_name: "Ada Example", email: "ada@example.com", phone: null },
  });
  expect(result.bytes.byteLength).toBeGreaterThan(1000);
  expect(result.filename).toContain("_sq.pdf");
  const hash = createHash("sha256").update(result.bytes).digest("hex");
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  if (process.env.FUNNEL_PDF_OUTPUT) {
    const outputPath = path.resolve(process.env.FUNNEL_PDF_OUTPUT);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.bytes);
    console.log(`FUNNEL_PDF_SHA256=${hash}`);
  }
});

test("generates Arrival Ready 12-month PDF with Home Refresh count", async () => {
  const pkg = FOUNDING_PACKAGES.arrival_ready;
  const result = await generateOfferPdf({
    offer_number: "STH-OFR-2026-0005", version: 1, selected_package: "arrival_ready",
    selected_term_months: 12, term_total_cents: pkg.termPrices[12],
    founding_customer_eligible: false, price_lock_statement: null,
    property_service_area_summary: "Apartament në Fushë Kosovë",
    visit_frequency: pkg.visits, included_services: pkg.included, exclusions: "Kontraktorët veç.",
    normal_approval_limit_cents: 10000, emergency_limit_cents: 30000,
    proposed_start_date: "2026-09-01", valid_until: "2026-08-25",
    consultation_summary: null, additional_agreed_items: null,
    lead: { full_name: "Besnik Test", email: null, phone: "+38344111222" },
  });
  expect(result.bytes.byteLength).toBeGreaterThan(1000);
  const hash = createHash("sha256").update(result.bytes).digest("hex");
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  if (process.env.FUNNEL_PDF_OUTPUT) {
    const outputPath = path.resolve(process.env.FUNNEL_PDF_OUTPUT, "arrival-ready-12.pdf");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.bytes);
    console.log(`ARRIVAL_READY_12_PDF_SHA256=${hash}`);
  }
});

test("migration keeps consultations and offers internal under RLS", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260728120000_add_founding_customer_funnel.sql"), "utf8");
  expect(sql).toContain("alter table public.lead_consultations enable row level security");
  expect(sql).toContain("alter table public.lead_offers enable row level security");
  expect(sql).toContain("on table public.lead_consultations, public.lead_offers");
  expect(sql).toContain("on sequence public.lead_offer_number_seq to authenticated");
  expect(sql).toContain("function public.can_manage_sales_funnel()");
  expect(sql).toContain("role in ('admin', 'office')");
  expect(sql).not.toContain("to anon");
  expect(sql).toContain("protect_lead_first_touch");
});

test("migration enforces founding capacity and one active founding offer per lead", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260728120000_add_founding_customer_funnel.sql"),
    "utf8"
  );
  expect(sql).toContain("idx_lead_offers_one_active_founding_per_lead");
  expect(sql).toContain("founding_customer_capacity");
  expect(sql).toContain("reserved_places < maximum_places");
  expect(sql).toContain("Founding-customer capacity is limited to three active places.");
});

test("lead detail explicitly selects the latest consultation", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/leads/[id]/page.tsx"), "utf8");
  expect(source).toMatch(
    /\.from\("lead_consultations"\)[\s\S]*?\.eq\("lead_id", id\)[\s\S]*?\.order\("scheduled_start", \{ ascending: false \}\)\s*\.order\("created_at", \{ ascending: false \}\)/
  );
});

test("offer transition rejects a concurrent loser before writing its event", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/actions/funnel.ts"), "utf8");
  const concurrencyCheck = source.indexOf('if (!transitionedOffer)');
  const eventWrite = source.indexOf("await event(", concurrencyCheck);
  expect(concurrencyCheck).toBeGreaterThan(-1);
  expect(eventWrite).toBeGreaterThan(concurrencyCheck);
});

test("forward reconciliation restores CRM runtime privileges without anonymous access", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260729001000_restore_crm_runtime_privileges.sql"),
    "utf8"
  );
  expect(sql).toContain("public.app_users");
  expect(sql).toContain("public.leads");
  expect(sql).toContain("public.lead_events");
  expect(sql).toContain("public.properties");
  expect(sql).toContain("to authenticated, service_role");
  expect(sql).not.toMatch(/\bto\s+anon\b/);
});

const RT003_LOCAL_DB = process.env.RT003_LOCAL_DB === "1";
const RT003_DB_CONTAINER =
  process.env.SUPABASE_DB_CONTAINER || "supabase_db_strehe-app";
const RT003_SOURCE_DETAIL = "rt003-offer-lifecycle-local-test";
const rt003RoleIds = {
  admin: randomUUID(),
  office: randomUUID(),
  field: randomUUID(),
  contractor: randomUUID(),
  agent: randomUUID(),
};

const rt003PsqlArgs = [
  "exec",
  "-i",
  RT003_DB_CONTAINER,
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

function rt003Psql(sql: string) {
  return execFileSync("docker", rt003PsqlArgs, {
    encoding: "utf8",
    input: sql,
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

function rt003PsqlConcurrent(sql: string) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string }>(
    (resolve) => {
      const child = execFile(
        "docker",
        rt003PsqlArgs,
        { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      );
      child.stdin!.end(sql);
    }
  );
}

function rt003DatabaseFailure(sql: string) {
  try {
    rt003Psql(sql);
  } catch (error) {
    const failure = error as {
      stderr?: string | Buffer;
      message?: string;
    };
    return String(failure.stderr || failure.message || error);
  }
  throw new Error("Expected the database operation to fail.");
}

function rt003CreateLead() {
  const leadId = randomUUID();
  rt003Psql(`
    insert into public.leads(
      id, full_name, source, source_detail, first_touch_at
    ) values (
      '${leadId}', 'RT-003 Synthetic Lead', 'local_test',
      '${RT003_SOURCE_DETAIL}', now()
    );
  `);
  return leadId;
}

function rt003InsertDraft(options?: {
  leadId?: string;
  founding?: boolean;
  validUntil?: string | null;
  monthlyPriceCents?: number;
  termMonths?: number;
}) {
  const offerId = randomUUID();
  const leadId = options?.leadId || rt003CreateLead();
  const founding = options?.founding === true;
  const termMonths = options?.termMonths ?? 12;
  const priceCents = options?.monthlyPriceCents ?? (founding ? 7500 : 45000);
  const validUntil =
    options?.validUntil === undefined
      ? "current_date + 14"
      : options.validUntil === null
        ? "null"
        : `'${options.validUntil}'::date`;
  rt003Psql(`
    insert into public.lead_offers(
      id, lead_id, version, status, selected_package, selected_term_months, monthly_price_cents,
      founding_customer_eligible, price_lock_months, price_lock_statement,
      property_service_area_summary, visit_frequency, included_services,
      exclusions, valid_until, consultation_summary
    ) values (
      '${offerId}', '${leadId}', 1, 'draft', 'essential_check',
      ${termMonths}, ${priceCents}, ${founding},
      ${founding ? "12" : "null"},
      ${founding ? "'Çmimi fiksohet për 12 muaj.'" : "null"},
      'RT-003 local area', 'Monthly', 'Synthetic services',
      'Synthetic exclusions', ${validUntil}, 'Synthetic consultation'
    );
  `);
  return { offerId, leadId };
}

function rt003SendOffer(
  offerId: string,
  sentAt = "2026-08-15T10:00:00+02:00",
  validUntil = "2026-08-15"
) {
  rt003Psql(`
    update public.lead_offers
    set status = 'sent',
        sent_at = '${sentAt}'::timestamptz,
        valid_until = '${validUntil}'::date
    where id = '${offerId}';
  `);
}

function rt003RoleUpdate(
  roleId: string,
  offerId: string,
  updateSql: string
) {
  return rt003Psql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '${roleId}', true);
    with changed as (
      update public.lead_offers
      set ${updateSql}
      where id = '${offerId}'
      returning id
    )
    select count(*) from changed;
    commit;
  `)
    .split(/\r?\n/)
    .find((line) => /^\d+$/.test(line));
}

function rt003LocalSupabaseEnvironment() {
  const apiUrl = process.env.RT003_API_URL || "";
  const anonKey = process.env.RT003_ANON_KEY || "";
  const jwtSecret = process.env.RT003_JWT_SECRET || "";
  if (
    !/^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/.test(apiUrl) ||
    !anonKey ||
    !jwtSecret
  ) {
    throw new Error("RT-003 tests require loopback-only local Supabase.");
  }
  return { apiUrl, anonKey, jwtSecret };
}

function rt003AuthenticatedToken(userId: string, jwtSecret: string) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    role: "authenticated",
    sub: userId,
  })}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

async function rt003DirectPatch(
  offerId: string,
  body: Record<string, unknown>
) {
  const { apiUrl, anonKey, jwtSecret } = rt003LocalSupabaseEnvironment();
  const accessToken = rt003AuthenticatedToken(rt003RoleIds.admin, jwtSecret);
  return fetch(
    `${apiUrl}/rest/v1/lead_offers?id=eq.${offerId}&select=id,status`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify(body),
    }
  );
}

test.describe("RT-003 local database lifecycle enforcement", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !RT003_LOCAL_DB,
    "Set RT003_LOCAL_DB=1 to run the isolated local database controls."
  );

  test.beforeAll(() => {
    rt003Psql(`
      delete from public.leads
      where source_detail = '${RT003_SOURCE_DETAIL}';
      delete from public.app_users
      where id in (
        '${rt003RoleIds.admin}', '${rt003RoleIds.office}',
        '${rt003RoleIds.field}', '${rt003RoleIds.contractor}'
      );
      delete from auth.users
      where id in (
        '${rt003RoleIds.admin}', '${rt003RoleIds.office}',
        '${rt003RoleIds.field}', '${rt003RoleIds.contractor}',
        '${rt003RoleIds.agent}'
      );

      insert into auth.users(id) values
        ('${rt003RoleIds.admin}'),
        ('${rt003RoleIds.office}'),
        ('${rt003RoleIds.field}'),
        ('${rt003RoleIds.contractor}'),
        ('${rt003RoleIds.agent}');

      insert into public.app_users(id, role, is_active) values
        ('${rt003RoleIds.admin}', 'admin', true),
        ('${rt003RoleIds.office}', 'office', true),
        ('${rt003RoleIds.field}', 'field', true),
        ('${rt003RoleIds.contractor}', 'contractor', true);

      insert into public.agent_principals(id, agent_key, display_name)
      values ('${rt003RoleIds.agent}', 'rt003-agent', 'RT-003 Agent');
    `);
  });

  test.afterEach(() => {
    rt003Psql(`
      delete from public.leads
      where source_detail = '${RT003_SOURCE_DETAIL}';
    `);
  });

  test.afterAll(() => {
    rt003Psql(`
      delete from public.leads
      where source_detail = '${RT003_SOURCE_DETAIL}';
      delete from public.app_users
      where id in (
        '${rt003RoleIds.admin}', '${rt003RoleIds.office}',
        '${rt003RoleIds.field}', '${rt003RoleIds.contractor}'
      );
      delete from auth.users
      where id in (
        '${rt003RoleIds.admin}', '${rt003RoleIds.office}',
        '${rt003RoleIds.field}', '${rt003RoleIds.contractor}',
        '${rt003RoleIds.agent}'
      );
    `);
  });

  test("RT003-T01 draft INSERT succeeds", () => {
    const { offerId } = rt003InsertDraft();
    expect(rt003Psql(
      `select status from public.lead_offers where id = '${offerId}';`
    )).toBe("draft");
  });

  test("RT003-T02 direct sent INSERT fails", () => {
    const leadId = rt003CreateLead();
    const failure = rt003DatabaseFailure(`
      insert into public.lead_offers(
        lead_id, status, selected_package, monthly_price_cents,
        property_service_area_summary, visit_frequency, included_services,
        exclusions, sent_at, valid_until
      ) values (
        '${leadId}', 'sent', 'essential_check', 7500, 'Area', 'Monthly',
        'Services', 'Exclusions', now(), current_date + 1
      );
    `);
    expect(failure).toContain("New offers must be created in draft status.");
  });

  test("RT003-T03 draft INSERT containing a lifecycle timestamp fails", () => {
    const leadId = rt003CreateLead();
    const failure = rt003DatabaseFailure(`
      insert into public.lead_offers(
        lead_id, status, selected_package, monthly_price_cents,
        property_service_area_summary, visit_frequency, included_services,
        exclusions, accepted_at
      ) values (
        '${leadId}', 'draft', 'essential_check', 7500, 'Area', 'Monthly',
        'Services', 'Exclusions', now()
      );
    `);
    expect(failure).toContain("cannot have lifecycle timestamps");
  });

  test("RT003-T04 draft valid_until editing succeeds", () => {
    const { offerId } = rt003InsertDraft({ validUntil: null });
    rt003Psql(`
      update public.lead_offers set valid_until = '2026-08-20'
      where id = '${offerId}';
    `);
    expect(rt003Psql(
      `select valid_until from public.lead_offers where id = '${offerId}';`
    )).toBe("2026-08-20");
  });

  test("RT003-T05 draft price editing succeeds", () => {
    const { offerId } = rt003InsertDraft();
    rt003Psql(`
      update public.lead_offers set monthly_price_cents = 8800
      where id = '${offerId}';
    `);
    expect(rt003Psql(
      `select monthly_price_cents from public.lead_offers where id = '${offerId}';`
    )).toBe("8800");
  });

  test("RT003-T06 draft lifecycle timestamp editing fails", () => {
    const { offerId } = rt003InsertDraft();
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set accepted_at = now()
      where id = '${offerId}';
    `);
    expect(failure).toContain("Draft offers cannot have lifecycle");
  });

  test("RT003-T07 valid draft to sent succeeds", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    expect(rt003Psql(
      `select status from public.lead_offers where id = '${offerId}';`
    )).toBe("sent");
  });

  test("RT003-T08 sent without valid_until fails", () => {
    const { offerId } = rt003InsertDraft({ validUntil: null });
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set status = 'sent', sent_at = now()
      where id = '${offerId}';
    `);
    expect(failure).toContain("require sent_at and valid_until");
  });

  test("RT003-T09 sent without sent_at fails", () => {
    const { offerId } = rt003InsertDraft();
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set status = 'sent'
      where id = '${offerId}';
    `);
    expect(failure).toContain("require sent_at and valid_until");
  });

  test("RT003-T10 valid_until before sent_at date fails", () => {
    const { offerId } = rt003InsertDraft({ validUntil: "2026-08-14" });
    const failure = rt003DatabaseFailure(`
      update public.lead_offers
      set status = 'sent', sent_at = '2026-08-15T10:00:00+02:00'
      where id = '${offerId}';
    `);
    expect(failure).toContain("valid_until must be on or after sent_at");
  });

  test("RT003-T11 same-day valid_until succeeds", () => {
    const { offerId } = rt003InsertDraft({ validUntil: "2026-08-15" });
    rt003SendOffer(offerId);
    expect(rt003Psql(
      `select status from public.lead_offers where id = '${offerId}';`
    )).toBe("sent");
  });

  test("RT003-T12 draft to accepted fails", () => {
    const { offerId } = rt003InsertDraft();
    const failure = rt003DatabaseFailure(`
      update public.lead_offers
      set status = 'accepted', accepted_at = now(),
          acceptance_evidence_note = 'Synthetic evidence'
      where id = '${offerId}';
    `);
    expect(failure).toContain("Cannot transition from draft to accepted");
  });

  test("RT003-T13 valid sent to accepted succeeds", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    rt003Psql(`
      update public.lead_offers
      set status = 'accepted', accepted_at = now(),
          acceptance_evidence_note = 'Synthetic acceptance evidence'
      where id = '${offerId}';
    `);
    expect(rt003Psql(
      `select status from public.lead_offers where id = '${offerId}';`
    )).toBe("accepted");
  });

  test("RT003-T14 acceptance without evidence fails", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    const failure = rt003DatabaseFailure(`
      update public.lead_offers
      set status = 'accepted', accepted_at = now()
      where id = '${offerId}';
    `);
    expect(failure).toContain("non-blank acceptance evidence");
  });

  test("RT003-T15 conflicting accepted and rejected timestamps fail", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    const failure = rt003DatabaseFailure(`
      update public.lead_offers
      set status = 'accepted', accepted_at = now(), rejected_at = now(),
          acceptance_evidence_note = 'Synthetic evidence'
      where id = '${offerId}';
    `);
    expect(failure).toContain("conflicting lifecycle data");
  });

  test("RT003-T16 terminal transition fails", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    rt003Psql(`
      update public.lead_offers
      set status = 'accepted', accepted_at = now(),
          acceptance_evidence_note = 'Synthetic evidence'
      where id = '${offerId}';
    `);
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set status = 'rejected'
      where id = '${offerId}';
    `);
    expect(failure).toContain("Cannot transition from terminal status accepted");
  });

  test("RT003-T17 sent price editing fails", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set monthly_price_cents = 9900
      where id = '${offerId}';
    `);
    expect(failure).toContain("Commercial offer fields cannot change");
  });

  test("RT003-T18 sent consultation-summary editing fails", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set consultation_summary = 'Changed summary'
      where id = '${offerId}';
    `);
    expect(failure).toContain("Commercial offer fields cannot change");
  });

  test("RT003-T19 sent follow_up_date editing succeeds", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    rt003Psql(`
      update public.lead_offers set follow_up_date = '2026-08-18'
      where id = '${offerId}';
    `);
    expect(rt003Psql(
      `select follow_up_date from public.lead_offers where id = '${offerId}';`
    )).toBe("2026-08-18");
  });

  test("RT003-T20 same-state lifecycle timestamp rewriting fails", () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    const failure = rt003DatabaseFailure(`
      update public.lead_offers set sent_at = sent_at + interval '1 second'
      where id = '${offerId}';
    `);
    expect(failure).toContain("Lifecycle fields cannot be modified");
  });

  test("RT003-T21 direct PostgREST draft to accepted fails", async () => {
    const { offerId } = rt003InsertDraft();
    const response = await rt003DirectPatch(offerId, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      acceptance_evidence_note: "Synthetic direct evidence",
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      "Cannot transition from draft to accepted"
    );
  });

  test("RT003-T22 admin valid transition succeeds", () => {
    const { offerId } = rt003InsertDraft();
    expect(rt003RoleUpdate(
      rt003RoleIds.admin,
      offerId,
      "status = 'sent', sent_at = now(), valid_until = current_date"
    )).toBe("1");
  });

  test("RT003-T23 office valid transition succeeds", () => {
    const { offerId } = rt003InsertDraft();
    expect(rt003RoleUpdate(
      rt003RoleIds.office,
      offerId,
      "status = 'sent', sent_at = now(), valid_until = current_date"
    )).toBe("1");
  });

  test("RT003-T24 field transition fails through RLS", () => {
    const { offerId } = rt003InsertDraft();
    expect(rt003RoleUpdate(
      rt003RoleIds.field,
      offerId,
      "status = 'sent', sent_at = now(), valid_until = current_date"
    )).toBe("0");
  });

  test("RT003-T25 contractor transition fails through RLS", () => {
    const { offerId } = rt003InsertDraft();
    expect(rt003RoleUpdate(
      rt003RoleIds.contractor,
      offerId,
      "status = 'sent', sent_at = now(), valid_until = current_date"
    )).toBe("0");
  });

  test("RT003-T26 agent transition fails through RLS", () => {
    const { offerId } = rt003InsertDraft();
    expect(rt003RoleUpdate(
      rt003RoleIds.agent,
      offerId,
      "status = 'sent', sent_at = now(), valid_until = current_date"
    )).toBe("0");
  });

  test("RT003-T27 anonymous transition fails", () => {
    const { offerId } = rt003InsertDraft();
    const failure = rt003DatabaseFailure(`
      begin;
      set local role anon;
      update public.lead_offers
      set status = 'sent', sent_at = now(), valid_until = current_date
      where id = '${offerId}';
      commit;
    `);
    expect(failure).toContain("permission denied for table lead_offers");
  });

  test("RT003-T28 competing sent transitions produce one winner", async () => {
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    const accepted = `
      update public.lead_offers
      set status = 'accepted', accepted_at = now(),
          acceptance_evidence_note = 'Concurrent acceptance'
      where id = '${offerId}' and status = 'sent'
      returning id;
    `;
    const rejected = `
      update public.lead_offers
      set status = 'rejected', rejected_at = now(),
          rejection_reason = 'Concurrent rejection'
      where id = '${offerId}' and status = 'sent'
      returning id;
    `;
    const results = await Promise.all([
      rt003PsqlConcurrent(accepted),
      rt003PsqlConcurrent(rejected),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.filter((result) => result.stdout.includes(offerId))).toHaveLength(1);
    expect(rt003Psql(
      `select status from public.lead_offers where id = '${offerId}';`
    )).toMatch(/^(accepted|rejected)$/);
  });

  test("RT003-T29 acceptance leaves contract and payment separation intact", () => {
    const paymentCountBefore = rt003Psql(
      "select count(*) from public.payments;"
    );
    const { offerId } = rt003InsertDraft();
    rt003SendOffer(offerId);
    rt003Psql(`
      update public.lead_offers
      set status = 'accepted', accepted_at = now(),
          acceptance_evidence_note = 'Synthetic evidence'
      where id = '${offerId}';
    `);
    expect(rt003Psql(`
      select
        (contract_id is null)::text || '|' ||
        (converted_client_id is null)::text || '|' ||
        (converted_property_id is null)::text
      from public.lead_offers where id = '${offerId}';
    `)).toBe("true|true|true");
    expect(rt003Psql("select count(*) from public.payments;")).toBe(
      paymentCountBefore
    );
  });

  test("RT003-T30 fourth founding place remains rejected", () => {
    for (let index = 0; index < 3; index += 1) {
      rt003InsertDraft({ founding: true });
    }
    const leadId = rt003CreateLead();
    const failure = rt003DatabaseFailure(`
      insert into public.lead_offers(
        lead_id, status, selected_package, monthly_price_cents,
        founding_customer_eligible, price_lock_months,
        property_service_area_summary, visit_frequency, included_services,
        exclusions
      ) values (
        '${leadId}', 'draft', 'essential_check', 7500, true, 12,
        'Area', 'Monthly', 'Services', 'Exclusions'
      );
    `);
    expect(failure).toContain(
      "Founding-customer capacity is limited to three active places"
    );
  });

  test("RT003-T31 duplicate active founding offer remains rejected", () => {
    const leadId = rt003CreateLead();
    rt003InsertDraft({ leadId, founding: true });
    const failure = rt003DatabaseFailure(`
      insert into public.lead_offers(
        lead_id, version, status, selected_package, monthly_price_cents,
        founding_customer_eligible, price_lock_months,
        property_service_area_summary, visit_frequency, included_services,
        exclusions
      ) values (
        '${leadId}', 2, 'draft', 'essential_check', 7500, true, 12,
        'Area', 'Monthly', 'Services', 'Exclusions'
      );
    `);
    expect(failure).toContain(
      "idx_lead_offers_one_active_founding_per_lead"
    );
  });
});
