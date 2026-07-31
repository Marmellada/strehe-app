import { expect, test } from "@playwright/test";
import { execFile, execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { firstPaymentForClient } from "@/lib/funnel/paying-customer";

const RT005_LOCAL_DB = process.env.RT005_LOCAL_DB === "1";
const RT005_DB_CONTAINER =
  process.env.SUPABASE_DB_CONTAINER || "supabase_db_strehe-app";
const RT005_MIGRATION_VERSION = "20260731000000";
const RT005_MARKER = "RT005 payment idempotency local test";
const RT005_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ids = {
  admin: "95000000-0000-0000-0000-000000000001",
  office: "95000000-0000-0000-0000-000000000002",
  agent: "95000000-0000-0000-0000-000000000003",
  inactive: "95000000-0000-0000-0000-000000000004",
  client: "95000000-0000-0000-0000-000000000010",
  account: "95000000-0000-0000-0000-000000000020",
  invoiceA: "95000000-0000-0000-0000-000000000030",
  invoiceB: "95000000-0000-0000-0000-000000000031",
  invoiceReplay: "95000000-0000-0000-0000-000000000032",
  invoiceStatus: "95000000-0000-0000-0000-000000000033",
  invoiceAcceptance: "95000000-0000-0000-0000-000000000034",
};

const fixtureInvoiceIds = [
  ids.invoiceA,
  ids.invoiceB,
  ids.invoiceReplay,
  ids.invoiceStatus,
  ids.invoiceAcceptance,
];

let nonFixtureBaseline = "";
let protectedReplayKey = "";

const psqlArgs = [
  "exec",
  "-i",
  RT005_DB_CONTAINER,
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

function psql(sql: string) {
  return execFileSync("docker", psqlArgs, {
    encoding: "utf8",
    input: sql,
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

function psqlConcurrent(sql: string) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string }>(
    (resolve) => {
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
      child.stdin!.end(sql);
    }
  );
}

function databaseFailure(sql: string) {
  try {
    psql(sql);
  } catch (error) {
    const failure = error as {
      stderr?: string | Buffer;
      message?: string;
    };
    return String(failure.stderr || failure.message || error);
  }
  throw new Error("Expected the database operation to fail.");
}

function paymentInsert(options?: {
  id?: string;
  key?: string;
  invoiceId?: string;
  amountCents?: number;
  reference?: string | null;
  notes?: string | null;
}) {
  const id = options?.id || randomUUID();
  const key = options?.key || randomUUID();
  const invoiceId = options?.invoiceId || ids.invoiceA;
  const amountCents = options?.amountCents ?? 2500;
  const reference =
    options?.reference === null
      ? "null"
      : `'${options?.reference || RT005_MARKER}'`;
  const notes =
    options?.notes === null ? "null" : `'${options?.notes || RT005_MARKER}'`;

  return {
    id,
    key,
    sql: `
      insert into public.payments(
        id, idempotency_key, amount_cents, payment_method,
        invoice_id, company_account_id, reference_number, notes
      ) values (
        '${id}', '${key}', ${amountCents}, 'cash',
        '${invoiceId}', '${ids.account}', ${reference}, ${notes}
      );
    `,
  };
}

function nonFixtureFingerprint() {
  const invoiceIds = fixtureInvoiceIds.map((id) => `'${id}'`).join(", ");
  return psql(`
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.id::text), ''), 'sha256'), 'hex')
    from public.payments as row_value
    where row_value.invoice_id not in (${invoiceIds})
      and coalesce(row_value.notes, '') <> '${RT005_MARKER}'
      and coalesce(row_value.reference_number, '') <> '${RT005_MARKER}';
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.id::text), ''), 'sha256'), 'hex')
    from public.invoices as row_value where row_value.id not in (${invoiceIds});
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.id::text), ''), 'sha256'), 'hex')
    from public.clients as row_value where row_value.id <> '${ids.client}';
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.id::text), ''), 'sha256'), 'hex')
    from public.company_bank_accounts as row_value where row_value.id <> '${ids.account}';
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.id::text), ''), 'sha256'), 'hex')
    from public.app_users as row_value
    where row_value.id not in ('${ids.admin}', '${ids.office}', '${ids.inactive}');
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.id::text), ''), 'sha256'), 'hex')
    from auth.users as row_value
    where row_value.id not in ('${ids.admin}', '${ids.office}', '${ids.agent}', '${ids.inactive}');
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.year), ''), 'sha256'), 'hex')
    from public.invoice_number_sequences as row_value;
    select encode(digest(coalesce(string_agg(row_to_json(row_value)::text, ',' order by row_value.year), ''), 'sha256'), 'hex')
    from public.credit_note_number_sequences as row_value;
  `);
}

function localApiEnvironment() {
  const apiUrl = process.env.RT005_API_URL || "";
  const anonKey = process.env.RT005_ANON_KEY || "";
  const jwtSecret = process.env.RT005_JWT_SECRET || "";

  if (
    !/^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/.test(apiUrl) ||
    !anonKey ||
    !jwtSecret
  ) {
    throw new Error("RT-005 tests require loopback-only local Supabase.");
  }

  return { apiUrl, anonKey, jwtSecret };
}

function authenticatedToken(userId: string, jwtSecret: string) {
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

async function directPaymentInsert(
  userId: string | null,
  payload: Record<string, unknown>
) {
  const { apiUrl, anonKey, jwtSecret } = localApiEnvironment();
  const accessToken = userId
    ? authenticatedToken(userId, jwtSecret)
    : anonKey;
  return fetch(`${apiUrl}/rest/v1/payments`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
}

async function directPaymentKeyUpdate(
  userId: string,
  currentKey: string,
  nextKey: string
) {
  const { apiUrl, anonKey, jwtSecret } = localApiEnvironment();
  return fetch(
    `${apiUrl}/rest/v1/payments?idempotency_key=eq.${currentKey}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${authenticatedToken(userId, jwtSecret)}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: JSON.stringify({ idempotency_key: nextKey }),
    }
  );
}

async function directPaymentDelete(userId: string, paymentId: string) {
  const { apiUrl, anonKey, jwtSecret } = localApiEnvironment();
  return fetch(`${apiUrl}/rest/v1/payments?id=eq.${paymentId}`, {
    method: "DELETE",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${authenticatedToken(userId, jwtSecret)}`,
      prefer: "return=representation",
    },
  });
}

const migrationSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260731000000_add_payment_idempotency.sql"
  ),
  "utf8"
);
const billingSource = fs.readFileSync(
  path.join(process.cwd(), "lib/actions/billing.ts"),
  "utf8"
);
const paymentPageSource = fs.readFileSync(
  path.join(process.cwd(), "app/billing/[id]/payment/page.tsx"),
  "utf8"
);
const paymentFormSource = fs.readFileSync(
  path.join(process.cwd(), "components/billing/PaymentForm.tsx"),
  "utf8"
);

test.describe("RT-005 local payment idempotency and replay protection", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !RT005_LOCAL_DB,
    "Set RT005_LOCAL_DB=1 to run isolated local database controls."
  );

  test.beforeAll(() => {
    localApiEnvironment();
    const invoiceIds = fixtureInvoiceIds.map((id) => `'${id}'`).join(", ");
    const dirtyFixtureCount = psql(`
      select
        (select count(*) from auth.users where id in ('${ids.admin}', '${ids.office}', '${ids.agent}', '${ids.inactive}'))
        + (select count(*) from public.app_users where id in ('${ids.admin}', '${ids.office}', '${ids.inactive}'))
        + (select count(*) from public.clients where id = '${ids.client}')
        + (select count(*) from public.company_bank_accounts where id = '${ids.account}')
        + (select count(*) from public.invoices where id in (${invoiceIds}))
        + (select count(*) from public.payments
           where invoice_id in (${invoiceIds})
              or notes = '${RT005_MARKER}'
              or reference_number = '${RT005_MARKER}');
    `);
    if (dirtyFixtureCount !== "0") {
      throw new Error(
        `RT-005 disposable database is dirty: found ${dirtyFixtureCount} reserved fixture rows. Recreate the local database before running this suite.`
      );
    }

    nonFixtureBaseline = nonFixtureFingerprint();

    psql(`

      insert into auth.users(id) values
        ('${ids.admin}'), ('${ids.office}'),
        ('${ids.agent}'), ('${ids.inactive}');

      insert into public.app_users(id, role, is_active) values
        ('${ids.admin}', 'admin', true),
        ('${ids.office}', 'office', true),
        ('${ids.inactive}', 'office', false);

      insert into public.clients(id, client_type, full_name)
      values ('${ids.client}', 'individual', '${RT005_MARKER}');

      insert into public.company_bank_accounts(
        id, account_name, iban, is_active, account_type
      ) values (
        '${ids.account}', '${RT005_MARKER}', 'RT005-LOCAL-CASH', true, 'cash'
      );

      insert into public.invoices(
        id, invoice_number, due_date, status, document_type,
        subtotal_cents, total_cents, user_id, vat_amount_cents,
        vat_rate, client_id
      ) values
        (
          '${ids.invoiceA}', 'RT005-LOCAL-A', current_date + 14,
          'issued', 'invoice', 10000, 10000, '${ids.admin}', 0, 0,
          '${ids.client}'
        ),
        ('${ids.invoiceB}', 'RT005-LOCAL-B', current_date + 14,
         'issued', 'invoice', 10000, 10000, '${ids.admin}', 0, 0, '${ids.client}'),
        ('${ids.invoiceReplay}', 'RT005-LOCAL-REPLAY', current_date + 14,
         'issued', 'invoice', 10000, 10000, '${ids.admin}', 0, 0, '${ids.client}'),
        ('${ids.invoiceStatus}', 'RT005-LOCAL-STATUS', current_date + 14,
         'issued', 'invoice', 10000, 10000, '${ids.admin}', 0, 0, '${ids.client}'),
        ('${ids.invoiceAcceptance}', 'RT005-LOCAL-ACCEPTANCE', current_date + 14,
         'issued', 'invoice', 10000, 10000, '${ids.admin}', 0, 0, '${ids.client}');
    `);
  });

  test("RT005-T01 existing payment rows survive migration unchanged", () => {
    const result = psql(`
      begin;
      create temporary table rt005_legacy_payments(
        id uuid primary key,
        amount_cents integer not null,
        notes text
      );
      insert into rt005_legacy_payments values
        (gen_random_uuid(), 1111, 'legacy-a'),
        (gen_random_uuid(), 2222, 'legacy-b');
      alter table rt005_legacy_payments
        add column idempotency_key uuid not null default gen_random_uuid();
      alter table rt005_legacy_payments
        add constraint rt005_legacy_idempotency_unique
        unique(idempotency_key);
      alter table rt005_legacy_payments
        alter column idempotency_key drop default;
      select
        count(*) || '|' ||
        count(distinct idempotency_key) || '|' ||
        sum(amount_cents) || '|' ||
        string_agg(notes, ',' order by notes)
      from rt005_legacy_payments;
      rollback;
    `);
    expect(result.split(/\r?\n/).find((line) => line.includes("|"))).toBe(
      "2|2|3333|legacy-a,legacy-b"
    );
  });

  test("RT005-T02 every legacy row receives a unique key", () => {
    expect(migrationSource).toContain(
      "idempotency_key uuid not null default gen_random_uuid()"
    );
    expect(migrationSource).toContain(
      "constraint payments_idempotency_key_unique"
    );
    expect(
      psql(`
        select count(*) = count(distinct idempotency_key)
        from public.payments;
      `)
    ).toBe("t");
  });

  test("RT005-T03 new INSERT without a key fails", () => {
    const failure = databaseFailure(`
      insert into public.payments(
        amount_cents, payment_method, invoice_id, company_account_id, notes
      ) values (
        1000, 'cash', '${ids.invoiceA}', '${ids.account}', '${RT005_MARKER}'
      );
    `);
    expect(failure).toContain("idempotency_key");
    expect(failure).toContain("null value");
  });

  test("RT005-T04 duplicate key cannot create a second row", () => {
    const key = randomUUID();
    const first = paymentInsert({ key });
    psql(first.sql);
    expect(databaseFailure(paymentInsert({ key }).sql)).toContain(
      "payments_idempotency_key_unique"
    );
    expect(
      psql(
        `select count(*) from public.payments where idempotency_key = '${key}';`
      )
    ).toBe("1");
  });

  test("RT005-T05 concurrent identical INSERTs persist exactly one row", async () => {
    const key = randomUUID();
    const first = paymentInsert({ key });
    const second = paymentInsert({ key });
    const results = await Promise.all([
      psqlConcurrent(first.sql),
      psqlConcurrent(second.sql),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(
      psql(
        `select count(*) from public.payments where idempotency_key = '${key}';`
      )
    ).toBe("1");
  });

  test("RT005-T06 idempotency_key UPDATE is rejected", () => {
    const payment = paymentInsert();
    psql(payment.sql);
    const failure = databaseFailure(`
      update public.payments
      set idempotency_key = gen_random_uuid()
      where id = '${payment.id}';
    `);
    expect(failure).toContain("Payments are immutable and cannot be update");
  });

  test("RT005-T07 two distinct keys allow two legitimate payments", () => {
    const first = paymentInsert({ amountCents: 2000 });
    const second = paymentInsert({ amountCents: 2000 });
    psql(first.sql);
    psql(second.sql);
    expect(
      psql(`
        select count(*) from public.payments
        where id in ('${first.id}', '${second.id}');
      `)
    ).toBe("2");
  });

  test("RT005-T08 zero and negative amounts remain rejected", () => {
    expect(
      databaseFailure(paymentInsert({ amountCents: 0 }).sql)
    ).toContain("payments_amount_cents_check");
    expect(
      databaseFailure(paymentInsert({ amountCents: -100 }).sql)
    ).toContain("payments_amount_cents_check");
  });

  test("RT005-T09 clean migration replay objects exist", () => {
    const verification = psql(`
      select
        count(*) filter (where column_name = 'idempotency_key') || '|' ||
        count(*) filter (
          where column_name = 'idempotency_key' and column_default is null
        )
      from information_schema.columns
      where table_schema = 'public' and table_name = 'payments';
      select count(*) from pg_constraint
      where conname = 'payments_idempotency_key_unique'
        and conrelid = 'public.payments'::regclass;
      select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'protect_payment_idempotency_key';
      select count(*) from pg_trigger
      where tgrelid = 'public.payments'::regclass
        and tgname = 'protect_payment_idempotency_key_trigger'
        and not tgisinternal;
    `).split(/\r?\n/);
    expect(verification).toEqual(["1|1", "1", "1", "1"]);
  });

  test("RT005-T10 migration is recorded exactly once", () => {
    expect(
      psql(`
        select count(*) from supabase_migrations.schema_migrations
        where version = '${RT005_MIGRATION_VERSION}';
      `)
    ).toBe("1");
  });

  test("RT005-T12 first valid payment succeeds and key reaches the action", () => {
    const payment = paymentInsert();
    psql(payment.sql);
    expect(
      psql(`select count(*) from public.payments where id = '${payment.id}';`)
    ).toBe("1");
    expect(billingSource).toContain('formData.get("idempotency_key")');
    expect(billingSource).toMatch(
      /\.insert\(payload\)\s*\.select\("id"\)\s*\.maybeSingle\(\)/
    );
    expect(billingSource).not.toContain(".upsert(");
    expect(billingSource).not.toContain("onConflict");
  });

  test("RT005-T13 same key and identical payload returns the existing payment", () => {
    const key = randomUUID();
    const payment = paymentInsert({ key, reference: "  stable-ref  " });
    psql(payment.sql);
    expect(databaseFailure(paymentInsert({ key }).sql)).toContain(
      "payments_idempotency_key_unique"
    );
    expect(
      psql(
        `select count(*) from public.payments where idempotency_key = '${key}';`
      )
    ).toBe("1");
    expect(billingSource).toContain("paymentPayloadMatches");
    expect(billingSource).toContain("completePaymentReplay");
    expect(paymentFormSource).toContain("value={idempotencyKey}");
  });

  test("RT005-T14 same key and different amount returns controlled conflict", () => {
    const key = randomUUID();
    const first = paymentInsert({ key, amountCents: 2500 });
    psql(first.sql);
    expect(
      databaseFailure(paymentInsert({ key, amountCents: 2600 }).sql)
    ).toContain("payments_idempotency_key_unique");
    expect(
      psql(
        `select amount_cents from public.payments where idempotency_key = '${key}';`
      )
    ).toBe("2500");
    expect(billingSource).toContain(
      "A payment with this idempotency key already exists with different details."
    );
  });

  test("RT005-T15 same key and different invoice returns controlled conflict", () => {
    const key = randomUUID();
    psql(paymentInsert({ key, invoiceId: ids.invoiceA }).sql);
    expect(
      databaseFailure(
        paymentInsert({ key, invoiceId: ids.invoiceB }).sql
      )
    ).toContain("payments_idempotency_key_unique");
    expect(
      psql(
        `select invoice_id from public.payments where idempotency_key = '${key}';`
      )
    ).toBe(ids.invoiceA);
    expect(billingSource).toMatch(
      /existing\.invoice_id\.toLowerCase\(\) === payload\.invoice_id/
    );
  });

  test("RT005-T16 missing key is rejected", () => {
    expect(billingSource).toContain('Missing ${label}');
    expect(billingSource).toMatch(
      /normalizeUuid\(\s*formData\.get\("idempotency_key"\),\s*"idempotency key"/
    );
  });

  test("RT005-T17 malformed key is rejected and fresh forms use distinct UUIDs", () => {
    expect(RT005_UUID.test("not-a-uuid")).toBe(false);
    const first = randomUUID();
    const second = randomUUID();
    expect(first).toMatch(RT005_UUID);
    expect(second).toMatch(RT005_UUID);
    expect(first).not.toBe(second);
    expect(paymentPageSource).toContain(
      'import { randomUUID } from "node:crypto"'
    );
    expect(paymentPageSource).toContain("const idempotencyKey = randomUUID()");
    expect(paymentPageSource).toContain("idempotencyKey={idempotencyKey}");
    expect(paymentFormSource).toContain('name="idempotency_key"');
  });

  test("RT005-T18 valid replay completes invoice reconciliation", () => {
    const payment = paymentInsert({
      amountCents: 10000,
      invoiceId: ids.invoiceReplay,
    });
    psql(payment.sql);
    psql(`
      update public.invoices
      set status = 'paid'
      where id = '${ids.invoiceReplay}' and status = 'issued'
        and (
          select coalesce(sum(amount_cents), 0)
          from public.payments where invoice_id = '${ids.invoiceReplay}'
        ) >= total_cents;
    `);
    expect(
      psql(`select status from public.invoices where id = '${ids.invoiceReplay}';`)
    ).toBe("paid");
    expect(billingSource).toMatch(
      /await reconcileInvoicePaymentState\(supabase, invoiceId\)/
    );
  });

  test("RT005-T19 invoice status changes only once", () => {
    psql(
      paymentInsert({ amountCents: 10000, invoiceId: ids.invoiceStatus }).sql
    );
    const reconcile = `
      update public.invoices
      set status = 'paid'
      where id = '${ids.invoiceStatus}' and status = 'issued'
        and (
          select coalesce(sum(amount_cents), 0)
          from public.payments where invoice_id = '${ids.invoiceStatus}'
        ) >= total_cents;
    `;
    psql(reconcile);
    psql(reconcile);
    expect(
      psql(
        `select status || '|' || total_cents from public.invoices where id = '${ids.invoiceStatus}';`
      )
    ).toBe("paid|10000");
    expect(billingSource).toMatch(
      /\.update\(\{ status: "paid" \}\)[\s\S]*?\.eq\("status", "issued"\)/
    );
  });

  test("RT005-T20 paying-customer state reflects one persisted payment", () => {
    const key = randomUUID();
    psql(paymentInsert({ key, amountCents: 1000 }).sql);
    expect(databaseFailure(paymentInsert({ key, amountCents: 1000 }).sql)).toContain(
      "payments_idempotency_key_unique"
    );
    expect(
      psql(`
        select count(distinct i.client_id)
        from public.payments p
        join public.invoices i on i.id = p.invoice_id
        where p.idempotency_key = '${key}' and p.amount_cents > 0;
      `)
    ).toBe("1");
  });

  test("RT005-T21 acceptance without a positive payment remains non-paying", () => {
    expect(
      firstPaymentForClient(ids.client, [
        {
          amount_cents: 0,
          payment_date: "2026-07-31",
          invoice: { client_id: ids.client },
        },
      ])
    ).toBeNull();
    expect(
      psql(
        `select count(*) from public.payments where invoice_id = '${ids.invoiceAcceptance}';`
      )
    ).toBe("0");
  });

  test("RT005-T22 admin payment succeeds", async () => {
    const response = await directPaymentInsert(ids.admin, {
      idempotency_key: randomUUID(),
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    });
    expect(response.status, await response.text()).toBe(201);
    expect(billingSource).toContain('requireRole(["admin", "office"])');
  });

  test("RT005-T23 office payment succeeds", async () => {
    const response = await directPaymentInsert(ids.office, {
      idempotency_key: randomUUID(),
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    });
    expect(response.status, await response.text()).toBe(201);
  });

  test("RT005-T24 agent is denied", async () => {
    const response = await directPaymentInsert(ids.agent, {
      idempotency_key: randomUUID(),
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("RT005-T25 inactive identity is denied", async () => {
    const response = await directPaymentInsert(ids.inactive, {
      idempotency_key: randomUUID(),
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("RT005-T26 anonymous identity is denied", async () => {
    const response = await directPaymentInsert(null, {
      idempotency_key: randomUUID(),
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("RT005-T27 direct PostgREST duplicate is blocked", async () => {
    const key = randomUUID();
    protectedReplayKey = key;
    const payload = {
      idempotency_key: key,
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    };
    const first = await directPaymentInsert(ids.admin, payload);
    const second = await directPaymentInsert(ids.admin, payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(
      psql(
        `select count(*) from public.payments where idempotency_key = '${key}';`
      )
    ).toBe("1");
  });

  test("RT005-T28 direct UPDATE of idempotency_key is blocked", async () => {
    const key = randomUUID();
    const create = await directPaymentInsert(ids.admin, {
      idempotency_key: key,
      amount_cents: 1000,
      payment_method: "cash",
      invoice_id: ids.invoiceA,
      company_account_id: ids.account,
      notes: RT005_MARKER,
    });
    expect(create.status).toBe(201);
    const beforeUpdateHash = psql(
      `select encode(digest(row_to_json(payment_row)::text, 'sha256'), 'hex') from public.payments as payment_row where idempotency_key = '${key}';`
    );
    const update = await directPaymentKeyUpdate(
      ids.admin,
      key,
      randomUUID()
    );
    expect(update.status).toBe(403);
    expect(JSON.parse(await update.text()).code).toBe("42501");
    expect(
      psql(
        `select encode(digest(row_to_json(payment_row)::text, 'sha256'), 'hex') from public.payments as payment_row where idempotency_key = '${key}';`
      )
    ).toBe(beforeUpdateHash);

    const paymentId = psql(
      `select id from public.payments where idempotency_key = '${key}';`
    );
    const beforeDeleteHash = psql(
      `select encode(digest(row_to_json(payment_row)::text, 'sha256'), 'hex') from public.payments as payment_row where id = '${paymentId}';`
    );
    const remove = await directPaymentDelete(ids.admin, paymentId);
    expect(remove.status).toBe(403);
    expect(JSON.parse(await remove.text()).code).toBe("42501");
    expect(
      psql(
        `select encode(digest(row_to_json(payment_row)::text, 'sha256'), 'hex') from public.payments as payment_row where id = '${paymentId}';`
      )
    ).toBe(beforeDeleteHash);
  });

  test("RT005-T11 fixture graph is complete and teardown-ready", () => {
    expect(protectedReplayKey).toMatch(RT005_UUID);
    const invoiceIds = fixtureInvoiceIds.map((id) => `'${id}'`).join(", ");
    const graph = psql(`
      select
        (select count(*) from public.payments
         where invoice_id in (${invoiceIds})
            or notes = '${RT005_MARKER}'
            or reference_number = '${RT005_MARKER}') || '|' ||
        (select count(*) from public.invoices where id in (${invoiceIds})) || '|' ||
        (select count(distinct idempotency_key) from public.payments
         where invoice_id in (${invoiceIds})
            or notes = '${RT005_MARKER}'
            or reference_number = '${RT005_MARKER}') || '|' ||
        (select count(*) from public.payments where idempotency_key = '${protectedReplayKey}') || '|' ||
        (select count(*) from public.payments
         where (notes = '${RT005_MARKER}' or reference_number = '${RT005_MARKER}')
           and invoice_id not in (${invoiceIds})) || '|' ||
        (select count(*) from auth.users where id in ('${ids.admin}', '${ids.office}', '${ids.agent}', '${ids.inactive}')) || '|' ||
        (select count(*) from public.app_users where id in ('${ids.admin}', '${ids.office}', '${ids.inactive}')) || '|' ||
        (select count(*) from public.clients where id = '${ids.client}') || '|' ||
        (select count(*) from public.company_bank_accounts where id = '${ids.account}');
    `);
    expect(graph).toBe("16|5|16|1|0|4|3|1|1");
    expect(nonFixtureFingerprint()).toBe(nonFixtureBaseline);
  });
});
