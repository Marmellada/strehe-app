import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AppRole = "admin" | "office" | "field" | "contractor" | "household";

type Credential = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
};

const credentials = {} as Record<AppRole, Credential>;
let admin: SupabaseClient;
let reviewJobId = "";
let expiredConversationId = "";
let openConversationId = "";

function requireLocalConfig(name: string) {
  const value = process.env[name]?.trim() || "";
  if (!value) throw new Error(`Missing ${name} for credentialed release-gate E2E.`);
  return value;
}

async function provisionRoleUser(role: AppRole, suffix: string) {
  const email = `gate.${role}.${suffix}@example.invalid`;
  const password = `Gate-${randomUUID()}-Aa1!`;
  const fullName = `Gate ${role[0].toUpperCase()}${role.slice(1)}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`Unable to provision ${role} auth user: ${error?.message}`);
  const profileResult = await admin.from("app_users").insert({
    id: data.user.id,
    email,
    username: `gate.${role}.${suffix}`,
    full_name: fullName,
    role,
    is_active: true,
  });
  if (profileResult.error) throw new Error(`Unable to provision ${role} app user: ${profileResult.error.message}`);
  return { id: data.user.id, email, password, fullName, role } satisfies Credential;
}

async function loginAs(page: Page, credential: Credential) {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.getByLabel("Username or Email").fill(credential.email);
  await page.getByLabel("Password").fill(credential.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
}

async function authenticatedClient(credential: Credential) {
  const client = createClient(
    requireLocalConfig("NEXT_PUBLIC_SUPABASE_URL"),
    requireLocalConfig("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await client.auth.signInWithPassword({
    email: credential.email,
    password: credential.password,
  });
  if (error) throw new Error(`Unable to authenticate ${credential.role} API client: ${error.message}`);
  return client;
}

function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPostgresFixture(sql: string) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      process.env.SUPABASE_DB_CONTAINER || "supabase_db_strehe-app",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
}

test.beforeAll(async () => {
  const url = requireLocalConfig("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
    throw new Error("Credentialed release-gate E2E refuses a non-loopback Supabase URL.");
  }
  admin = createClient(url, requireLocalConfig("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  runPostgresFixture(`
begin;
delete from public.agent_jobs where payload->>'session_id' like 'GATE-%';
delete from public.contact_channel_identities where channel_account_id like 'gate-account-%';
delete from public.app_users where email like 'gate.%@example.invalid';
commit;
`);

  const suffix = randomUUID().slice(0, 8);
  for (const role of ["admin", "office", "field", "contractor", "household"] as const) {
    credentials[role] = await provisionRoleUser(role, suffix);
  }

  const existingAgent = await admin
    .from("agent_principals")
    .select("id")
    .eq("agent_key", "engineering.local")
    .maybeSingle();
  if (existingAgent.error) throw new Error(`Unable to inspect Engineering principal: ${existingAgent.error.message}`);

  let agentId = existingAgent.data?.id || null;
  if (!agentId) {
    const agentAuth = await admin.auth.admin.createUser({
      email: `gate.agent.${suffix}@example.invalid`,
      password: `Gate-Agent-${randomUUID()}-Aa1!`,
      email_confirm: true,
    });
    if (agentAuth.error || !agentAuth.data.user) {
      throw new Error(`Unable to provision Engineering principal auth identity: ${agentAuth.error?.message}`);
    }
    agentId = agentAuth.data.user.id;
    const principal = await admin.from("agent_principals").insert({
      id: agentId,
      agent_key: "engineering.local",
      display_name: "Gate Engineering Agent",
      is_active: true,
    });
    if (principal.error) throw new Error(`Unable to provision Engineering principal: ${principal.error.message}`);
  }

  reviewJobId = randomUUID();
  const reviewPayload = JSON.stringify({
    target_module: "phase2/operator-workflows",
    session_id: `GATE-${suffix.toUpperCase()}`,
    base_commit: "a".repeat(40),
    commit_sha: "b".repeat(40),
    secret_not_whitelisted: "must-not-render",
  });
  const reviewResult = JSON.stringify({
    summary: "Credentialed Phase 2 gate review",
    findings: [{
      summary: "Credentialed bounded finding",
      severity: "low",
      evidence: ["local Supabase integration evidence"],
      recommendation: "Record a human decision.",
      secret_not_whitelisted: "must-not-render",
    }],
    secret_not_whitelisted: "must-not-render",
  });

  const identities = Array.from({ length: 27 }, (_, index) => ({
    id: randomUUID(),
    channel: (["whatsapp", "instagram", "messenger"] as const)[index % 3],
    channel_account_id: `gate-account-${suffix}-${index + 1}`,
    external_id: `gate-contact-${suffix}-${index + 1}`,
    display_name: index === 0 ? "Gate Search Needle" : `Gate Contact ${index + 1}`,
    phone_e164: `+3834900${String(index + 1).padStart(3, "0")}`,
    resolution_status: index === 1 ? "needs_review" : "unresolved",
  }));
  const now = Date.now();
  const conversations = identities.map((identity, index) => {
    const occurredAt = new Date(now - (index + 1) * 60 * 60 * 1000).toISOString();
    return {
      id: randomUUID(),
      contact_identity_id: identity.id,
      status: "open",
      attention_state: "needs_reply",
      assigned_user_id: index === 0 ? credentials.admin.id : index === 1 ? credentials.office.id : null,
      unread_count: index % 2 === 0 ? 3 : 0,
      last_message_at: occurredAt,
      last_inbound_at: occurredAt,
    };
  });
  openConversationId = conversations[0]?.id || "";
  expiredConversationId = conversations.at(-1)?.id || "";

  const identityValues = identities.map((identity) =>
    `(${sqlText(identity.id)},${sqlText(identity.channel)},${sqlText(identity.channel_account_id)},${sqlText(identity.external_id)},${sqlText(identity.display_name)},${sqlText(identity.phone_e164)},${sqlText(identity.resolution_status)})`
  ).join(",\n");
  const conversationValues = conversations.map((conversation) =>
    `(${sqlText(conversation.id)},${sqlText(conversation.contact_identity_id)},'open','needs_reply',${conversation.assigned_user_id ? sqlText(conversation.assigned_user_id) : "null"},${conversation.unread_count},${sqlText(conversation.last_message_at)},${sqlText(conversation.last_inbound_at)})`
  ).join(",\n");
  const messageValues = conversations.map((conversation, index) => {
    const identity = identities[index];
    return `(${sqlText(conversation.id)},${sqlText(identity.channel)},${sqlText(identity.channel_account_id)},${sqlText(`gate-message-${suffix}-${index + 1}`)},'inbound','text',${sqlText(`Credentialed inbox message ${index + 1}`)},${sqlText(identity.external_id)},${sqlText(conversation.last_inbound_at)})`;
  }).join(",\n");

  runPostgresFixture(`
begin;
insert into public.agent_jobs (
  id, job_type, required_capability, workspace_type, assigned_agent_id, status,
  priority, payload, result, requires_review, processed_at
) values (
  ${sqlText(reviewJobId)}, 'engineering.review', 'engineering.local', 'system',
  ${sqlText(agentId)}, 'awaiting_review', 10, ${sqlText(reviewPayload)}::jsonb,
  ${sqlText(reviewResult)}::jsonb, true, now()
);
insert into public.contact_channel_identities (
  id, channel, channel_account_id, external_id, display_name, phone_e164, resolution_status
) values ${identityValues};
insert into public.conversations (
  id, contact_identity_id, status, attention_state, assigned_user_id, unread_count,
  last_message_at, last_inbound_at
) values ${conversationValues};
insert into public.conversation_messages (
  conversation_id, channel, channel_account_id, external_message_id, direction,
  message_type, text_content, sender_external_id, occurred_at
) values ${messageValues};
commit;
`);
});

const routes = [
  { href: "/dashboard", heading: "Daily operations" },
  { href: "/operator/inbox", heading: "Inbox" },
  { href: "/operator/review", heading: "Review queue" },
];

for (const width of [320, 375, 768]) {
  test(`operator workflows fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of routes) {
      await page.goto(route.href);
      await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        elements: Array.from(document.querySelectorAll("*"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName, className: element.className, left: rect.left, right: rect.right, width: rect.width };
          })
          .filter((element) => element.right > document.documentElement.clientWidth + 1 || element.left < -1)
          .slice(0, 12),
      }));
      expect(
        overflow.scrollWidth > overflow.clientWidth,
        `${route.href} should not overflow at ${width}px: ${JSON.stringify(overflow)}`
      ).toBe(false);
    }
  });
}

test("inbox filter controls have a deterministic keyboard sequence", async ({ page }) => {
  await page.goto("/operator/inbox");
  const search = page.getByLabel("Search contacts");
  const readState = page.getByLabel("Read state");
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(readState).toBeFocused();
});

test("operator surfaces expose status announcements and real review deep links", async ({ page }) => {
  await page.goto("/operator/review");
  await expect(page.locator('[role="status"][aria-live="polite"]').first()).toBeAttached();

  const reviewLinks = page.getByRole("link", { name: "Review job" });
  if ((await reviewLinks.count()) > 0) {
    const href = await reviewLinks.first().getAttribute("href");
    expect(href).toMatch(/^\/operator\/agents\/jobs\/[0-9a-f-]{36}$/i);
    await reviewLinks.first().click();
    await expect(page.getByRole("heading", { name: "Engineering job review" })).toBeVisible();
  }
});

test("real role credentials enforce dashboard, shell, review UI, and RPC boundaries", async ({ page }) => {
  await loginAs(page, credentials.office);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Daily operations", level: 1 })).toBeVisible();
  await expect(page.locator("nav.shell-nav").getByRole("link", { name: "Inbox" })).toBeVisible();
  await page.goto("/operator/review");
  await expect(page.getByText("Office monitoring view")).toBeVisible();
  await page.getByRole("link", { name: "Review job" }).first().click();
  await expect(page.getByText("Admin decision required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve result" })).toHaveCount(0);

  const officeApi = await authenticatedClient(credentials.office);
  const officeRead = await officeApi.rpc("get_engineering_review_job", { p_job_id: reviewJobId });
  expect(officeRead.error).toBeNull();
  expect(officeRead.data?.id).toBe(reviewJobId);
  const officeDecision = await officeApi.rpc("review_agent_job", {
    target_job_id: reviewJobId,
    decision: "approved",
    notes: "office must not decide",
  });
  expect(officeDecision.error?.message).toContain("review access denied");

  for (const role of ["field", "contractor"] as const) {
    await loginAs(page, credentials[role]);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "My daily work", level: 1 })).toBeVisible();
    await expect(page.locator("nav.shell-nav").getByRole("link", { name: "Inbox" })).toHaveCount(0);
    await page.goto("/operator/review");
    await expect(page).toHaveURL(/\/unauthorized$/);
    await expect(page.getByRole("heading", { name: "Access Denied", level: 1 })).toBeVisible();

    const deniedApi = await authenticatedClient(credentials[role]);
    const deniedRead = await deniedApi.rpc("get_engineering_review_queue", { p_limit: 5, p_offset: 0 });
    expect(deniedRead.error?.message).toContain("Operator access required");
  }

  await loginAs(page, credentials.household);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByText("Household workspace not configured")).toBeVisible();
  await expect(page.locator("nav.shell-nav").getByRole("link", { name: "Inbox" })).toHaveCount(0);
  await page.goto("/operator/inbox");
  await expect(page).toHaveURL(/\/unauthorized$/);
  const householdApi = await authenticatedClient(credentials.household);
  const householdRead = await householdApi.rpc("get_engineering_review_job", { p_job_id: reviewJobId });
  expect(householdRead.error?.message).toContain("Operator access required");
});

test("credentialed inbox uses exact pagination, filters, search, and a fail-closed reply window", async ({ page }) => {
  await loginAs(page, credentials.admin);
  await page.goto("/operator/inbox");
  await expect(page.getByText("Showing 25 of 27 matching conversations. Page 1 of 2.")).toBeVisible();
  await expect(page.locator("nav.shell-nav").getByLabel("27 conversations need a reply")).toBeAttached();
  await page.getByRole("navigation", { name: "Inbox pages" }).getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Showing 2 of 27 matching conversations. Page 2 of 2.")).toBeVisible();

  await page.goto("/operator/inbox");
  await page.getByLabel("Search contacts").fill("Gate Search Needle");
  await page.getByLabel("Read state").selectOption("unread");
  await page.getByLabel("Channel").selectOption("whatsapp");
  await page.getByLabel("Assigned").selectOption("me");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/q=Gate\+Search\+Needle/);
  await expect(page.getByText("Showing 1 of 1 matching conversations. Page 1 of 1.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Gate Search Needle" }).first()).toBeVisible();

  await page.goto(`/operator/inbox/${expiredConversationId}`);
  await expect(page.getByText("Reply window closed")).toBeVisible();
  await expect(page.getByPlaceholder("Write a reply")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();

  await page.goto(`/operator/inbox/${openConversationId}`);
  await expect(page.getByText("24-hour reply window open")).toBeVisible();
  await expect(page.getByPlaceholder("Write a reply")).toBeEnabled();
  runPostgresFixture(`
update public.conversations
set last_inbound_at = now() - interval '25 hours'
where id = ${sqlText(openConversationId)};
`);
  await page.getByPlaceholder("Write a reply").fill("This must be rejected by the server-side window guard.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("The 24-hour messaging window has closed.");

  const adminApi = await authenticatedClient(credentials.admin);
  const outboundBefore = await adminApi
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", [expiredConversationId, openConversationId])
    .eq("direction", "outbound");
  expect(outboundBefore.error).toBeNull();
  expect(outboundBefore.count).toBe(0);
});

test("admin resolves a real review job and provenance is returned by both read models", async ({ page }) => {
  await loginAs(page, credentials.admin);
  await page.goto(`/operator/agents/jobs/${reviewJobId}`);
  await expect(page.getByRole("heading", { name: "Engineering job review", level: 1 })).toBeVisible();
  await expect(page.getByText("Credentialed Phase 2 gate review")).toBeVisible();
  await expect(page.getByText("must-not-render")).toHaveCount(0);
  await page.getByLabel("Decision notes").fill("Credentialed local release-gate approval");
  await page.getByRole("button", { name: "Approve result" }).click();
  await expect(page.getByText("Gate Admin approved this job at", { exact: false })).toBeVisible();
  await expect(page.getByText("Credentialed local release-gate approval")).toBeVisible();

  const adminApi = await authenticatedClient(credentials.admin);
  const detail = await adminApi.rpc("get_engineering_review_job", { p_job_id: reviewJobId });
  expect(detail.error).toBeNull();
  expect(detail.data).toMatchObject({
    id: reviewJobId,
    review_decision: "approved",
    reviewer_name: "Gate Admin",
    review_notes: "Credentialed local release-gate approval",
  });
  expect(JSON.stringify(detail.data)).not.toContain("secret_not_whitelisted");

  const queue = await adminApi.rpc("get_engineering_review_queue", { p_limit: 5, p_offset: 0 });
  expect(queue.error).toBeNull();
  expect(queue.data.pending_count).toBe(0);
  expect(queue.data.recent_decisions).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: reviewJobId, reviewer_name: "Gate Admin" })])
  );

  await page.goto("/operator/review");
  await expect(page.getByText("Credentialed Phase 2 gate review")).toBeVisible();
  await expect(page.getByText("Gate Admin approved this job at", { exact: false })).toBeVisible();
});
