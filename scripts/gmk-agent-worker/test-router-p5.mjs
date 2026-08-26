import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import inboxSpec, { buildInboxPrompt } from "./agents/inbox.spec.mjs";
import {
  assertInboxCandidate,
  assertSyntheticInboxFixture,
  detectFixtureRisks,
} from "./lib/inbox/contract.mjs";
import { assertJobAuthority } from "./lib/router/authority.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import { DEFAULT_MODEL_CONFIG } from "./lib/router/config.mjs";
import { routeJob } from "./lib/router/route.mjs";
import { processNextJob } from "./lib/claim-loop.mjs";

const FIXTURE_ROOT = path.resolve("tests", "fixtures", "inbox");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, name), "utf8"));
}

function candidateFor(fx, overrides = {}) {
  const byId = {
    "strehe-fixture-inbox-v1-albanian-services": {
      intent: "services_inquiry", category: "services", urgency: "low",
      draft_reply: "Faleminderit që na kontaktuat. Mund t’ju shpjegojmë shërbimet e kujdesit për pronën; cilën nevojë dëshironi të trajtojmë së pari?",
    },
    "strehe-fixture-inbox-v1-diaspora-property-check": {
      intent: "property_check", category: "property", urgency: "medium",
      draft_reply: "Faleminderit që na shkruat. Mund ta shqyrtojmë kërkesën për kontroll të banesës; ju lutem, na tregoni zonën dhe llojin e kontrollit që ju nevojitet.",
    },
    "strehe-fixture-inbox-v1-moisture-mold": {
      intent: "moisture_concern", category: "safety", urgency: "medium",
      draft_reply: "Faleminderit që na njoftuat. Pa një vlerësim nuk mund ta përcaktojmë shkakun; ju lutem, na tregoni kur u vu re lagështia dhe sa zonë prek.",
      uncertainty_flags: ["inspection_not_performed", "property_details_missing"],
    },
    "strehe-fixture-inbox-v1-electrical-safety": {
      intent: "electrical_concern", category: "safety", urgency: "high",
      draft_reply: "Ju lutem, mos e prekni prizën dhe qëndroni larg zonës. Nëse mund ta bëni pa rrezik, fikni energjinë dhe kontaktoni një elektricist të kualifikuar ose shërbimet emergjente.",
      uncertainty_flags: ["electrical_condition_unverified"],
    },
    "strehe-fixture-inbox-v1-unclear-request": {
      intent: "clarification_needed", category: "clarification", urgency: "low", confidence: "low",
      draft_reply: "Përshëndetje dhe faleminderit që na shkruat. Për cilën pjesë të kujdesit të pronës dëshironi informacion?",
      uncertainty_flags: ["request_ambiguous"],
    },
    "strehe-fixture-inbox-v1-price-contract": {
      intent: "price_or_contract", category: "commercial", urgency: "medium",
      draft_reply: "Faleminderit që na shkruat. Nuk mund ta konfirmojmë çmimin ose statusin e kontratës pa të dhëna të verifikuara; ju lutem, tregoni cilin shërbim po kërkoni që operatori ta shqyrtojë.",
      uncertainty_flags: ["price_not_supplied", "contract_status_unknown"],
    },
    "strehe-fixture-inbox-v1-frustrated-customer": {
      intent: "complaint", category: "complaint", urgency: "high",
      draft_reply: "Na vjen keq për shqetësimin dhe e kuptojmë frustrimin tuaj. Ju lutem, na tregoni çfarë po prisnit që operatori ta shqyrtojë me kujdes.",
      uncertainty_flags: ["request_ambiguous"],
    },
    "strehe-fixture-inbox-v1-prompt-injection": {
      intent: "services_inquiry", category: "services", urgency: "low",
      draft_reply: "Thanks for asking about property care. Which type of support would you like information about?",
    },
    "strehe-fixture-inbox-v1-send-immediately": {
      intent: "services_inquiry", category: "services", urgency: "low",
      draft_reply: "Thanks for your interest in our services. Which property-care need would you like the operator to review?",
    },
    "strehe-fixture-inbox-v1-social-instagram": {
      intent: "services_inquiry", category: "services", urgency: "low",
      draft_reply: "Faleminderit që na gjetët në Instagram. Mund të fillojmë duke kuptuar nevojën tuaj; çfarë lloj kujdesi kërkon banesa?",
    },
    "strehe-fixture-inbox-v1-english-inquiry": {
      intent: "services_inquiry", category: "services", urgency: "low",
      draft_reply: "Thanks for contacting STREHE. A routine request starts by clarifying the property and the support needed; what would you like help with?",
    },
  };
  const selected = byId[fx.fixture_id];
  assert.ok(selected, `candidate fixture mapping exists for ${fx.fixture_id}`);
  return {
    schema_version: "strehe.inbox.result.v1",
    fixture_id: fx.fixture_id,
    channel: fx.channel,
    language: fx.declared_language,
    intent: selected.intent,
    category: selected.category,
    urgency: selected.urgency,
    suggested_attention: "needs_reply",
    confidence: selected.confidence || "high",
    summary: "Synthetic customer request categorized for operator review.",
    customer_needs: ["A clear, human-reviewed response"],
    draft_reply: selected.draft_reply,
    send: false,
    requires_human_review: true,
    risk_flags: detectFixtureRisks(fx),
    uncertainty_flags: selected.uncertainty_flags || [],
    decision_evidence: ["Classification is based only on the synthetic message text."],
    ...overrides,
  };
}

function runtimeReturning(value) {
  let calls = 0;
  return {
    get calls() { return calls; },
    llm: {
      provider: "fake-provider",
      model: "fake-inbox-model",
      protocol: "deterministic_fake",
      isExternal: false,
      async chat() {
        calls += 1;
        return typeof value === "string" ? value : JSON.stringify(value);
      },
    },
  };
}

function job(fx, jobType = "inbox.draft") {
  return { id: "synthetic-job", job_type: jobType, requires_review: true, payload: { conversation_fixture: fx } };
}

function retryBoundaryRuntime(fx, modelOutput) {
  const claimed = job(fx);
  let status = "queued";
  let providerCalls = 0;
  let failedCalls = 0;
  const runtime = {
    supabase: {
      from(table) {
        assert.equal(table, "agent_jobs");
        const query = {
          select() { return this; },
          eq() { return this; },
          lte() { return this; },
          gt() { return this; },
          order() { return this; },
          async limit() { return status === "queued" ? { data: [claimed], error: null } : { data: [], error: null }; },
        };
        return query;
      },
      async rpc(name) {
        if (name === "claim_agent_job") {
          assert.equal(status, "queued");
          status = "running";
          return { data: claimed, error: null };
        }
        if (name === "fail_agent_job") {
          failedCalls += 1;
          status = "failed";
          return { data: claimed, error: null };
        }
        throw new Error(`unexpected RPC in retry-boundary test: ${name}`);
      },
    },
    logger: { log() {} },
    recordRoutingOutcome() {},
    llm: {
      provider: "fake-provider",
      model: "fake-inbox-model",
      protocol: "deterministic_fake",
      isExternal: false,
      async chat() {
        providerCalls += 1;
        if (modelOutput instanceof Error) throw modelOutput;
        return modelOutput;
      },
    },
  };
  return {
    runtime,
    get providerCalls() { return providerCalls; },
    get failedCalls() { return failedCalls; },
    get status() { return status; },
  };
}

test("valid synthetic Albanian fixture produces a bounded structured review draft", async () => {
  const fx = fixture("a-albanian-services.json");
  const runtime = runtimeReturning(candidateFor(fx));
  const result = await inboxSpec.run(runtime, job(fx));
  assert.equal(result.schema_version, "strehe.inbox.result.v1");
  assert.equal(result.fixture_id, fx.fixture_id);
  assert.equal(result.language, "sq");
  assert.equal(result.send, false);
  assert.equal(result.requires_human_review, true);
  assert.equal(result.validation.outbound_authority, false);
  assert.equal(result.validation.fixture_only, true);
  assert.equal(result.runtime.provider, "fake-provider");
  assert.ok(result.draft_reply.length <= 700);
  assert.equal(runtime.calls, 1);
});

test("send is required and must be literal false", () => {
  const fx = fixture("a-albanian-services.json");
  assert.throws(() => assertInboxCandidate(candidateFor(fx, { send: true }), fx), (error) => error.code === "authority_blocked");
  const missing = candidateFor(fx);
  delete missing.send;
  assert.throws(() => assertInboxCandidate(missing, fx), /missing=\[send\]/);
});

test("malformed model schema fails closed with the authoritative classification", () => {
  const fx = fixture("a-albanian-services.json");
  const malformed = [
    [{ customer_needs: [] }, "schema_invalid"],
    [{ customer_needs: "A clear need" }, "schema_invalid"],
    [{ decision_evidence: [] }, "schema_invalid"],
    [{ risk_flags: null }, "schema_invalid"],
    [{ uncertainty_flags: "none" }, "schema_invalid"],
    [{ send: true }, "authority_blocked"],
    [{ requires_human_review: false }, "authority_blocked"],
  ];
  for (const [override, code] of malformed) {
    assert.throws(
      () => assertInboxCandidate(candidateFor(fx, override), fx),
      (error) => error.code === code,
      JSON.stringify(override),
    );
  }
});

test("Inbox deterministic failures never retry the unchanged job", async () => {
  const fx = fixture("a-albanian-services.json");
  const cases = [
    ["schema_invalid", JSON.stringify(candidateFor(fx, { customer_needs: [] }))],
    ["authority_blocked", JSON.stringify(candidateFor(fx, { send: true }))],
    ["schema_invalid", "not-json"],
    ["provider_context_exceeded", Object.assign(new Error("context window exceeded"), { code: "provider_context_exceeded" })],
    ["provider_request_failed", Object.assign(new Error("request rejected"), { code: "provider_request_failed" })],
  ];
  for (const [expectedCode, modelOutput] of cases) {
    const boundary = retryBoundaryRuntime(fx, modelOutput);
    assert.equal(await processNextJob(boundary.runtime, inboxSpec), true, expectedCode);
    assert.equal(await processNextJob(boundary.runtime, inboxSpec), false, `${expectedCode} re-claimed the failed job`);
    assert.equal(boundary.providerCalls, 1, `${expectedCode} made an unchanged second provider call`);
    assert.equal(boundary.failedCalls, 1, `${expectedCode} did not fail the job exactly once`);
    assert.equal(boundary.status, "failed");
  }
});

test("unexpected action, tool, and send-like fields are rejected", () => {
  const fx = fixture("a-albanian-services.json");
  for (const extra of [{ action: "send" }, { tools: ["sendMetaMessage"] }, { outbound_action: "none" }]) {
    assert.throws(() => assertInboxCandidate({ ...candidateFor(fx), ...extra }, fx), /unexpected=/);
  }
});

test("real-looking IDs and live Inbox payload references fail before model execution", () => {
  const fx = fixture("a-albanian-services.json");
  const liveId = "123e4567-e89b-42d3-a456-426614174000";
  assert.throws(() => assertSyntheticInboxFixture({ ...fx, fixture_id: liveId }), (error) => error.code === "authority_blocked");
  assert.throws(() => assertJobAuthority({ job_type: "inbox.triage", requires_review: true, payload: { conversation_id: liveId } }), (error) => error.code === "authority_blocked");
  assert.throws(() => assertJobAuthority({ job_type: "inbox.draft", requires_review: true, payload: { conversation_fixture: fx, customer_id: liveId } }), (error) => error.code === "authority_blocked");
});

test("fixture identity, supported channel, and exact fixture shape are mandatory", () => {
  const fx = fixture("a-albanian-services.json");
  for (const invalid of [
    { ...fx, synthetic: false },
    { ...fx, fixture_marker: "maybe-test" },
    { ...fx, source: "production" },
    { ...fx, channel: "email" },
    { ...fx, external_customer_id: "synthetic" },
    { ...fx, messages: [] },
  ]) assert.throws(() => assertSyntheticInboxFixture(invalid));
});

test("durable job review is mandatory in both authority and agent execution", async () => {
  const fx = fixture("a-albanian-services.json");
  const unreviewed = { ...job(fx), requires_review: false };
  assert.throws(() => assertJobAuthority(unreviewed), (error) => error.code === "authority_blocked");
  await assert.rejects(
    () => inboxSpec.run(runtimeReturning(candidateFor(fx)), unreviewed),
    (error) => error.code === "authority_blocked",
  );
  assert.equal(assertJobAuthority(job(fx)), true);
});

test("prompt injection cannot change authority or send policy", async () => {
  const fx = fixture("h-prompt-injection.json");
  const unsafeRuntime = runtimeReturning(candidateFor(fx, { send: true }));
  await assert.rejects(() => inboxSpec.run(unsafeRuntime, job(fx)), (error) => error.code === "authority_blocked");
  const safe = await inboxSpec.run(runtimeReturning(candidateFor(fx)), job(fx));
  assert.equal(safe.send, false);
  assert.equal(safe.validation.prompt_injection_contained, true);
  assert.ok(safe.risk_flags.includes("prompt_injection"));
});

test("invented completed actions and delivery claims are rejected", () => {
  const fx = fixture("a-albanian-services.json");
  for (const draft_reply of [
    "Faleminderit. E kemi kontrolluar tashmë pronën tuaj.",
    "Faleminderit. Mesazhi është dërguar automatikisht.",
    "Thanks. We have already scheduled the property visit.",
  ]) assert.throws(
    () => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx),
    (error) => error.code === "validation_failed",
    draft_reply,
  );
});

test("passive completed inspection fabrications are rejected", () => {
  const fx = fixture("k-english-inquiry.json");
  for (const draft_reply of [
    "Thanks. The inspection was completed.",
    "Thanks. The inspection has been completed.",
  ]) assert.throws(() => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx), (error) => error.code === "validation_failed");
});

test("payment, technician, and appointment completion fabrications are rejected", () => {
  const fx = fixture("k-english-inquiry.json");
  for (const draft_reply of [
    "Thanks. Payment received.",
    "Thanks. The technician was dispatched.",
    "Thanks. The appointment has been confirmed.",
    "Thanks. Your visit is booked and arranged.",
  ]) assert.throws(() => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx), (error) => error.code === "validation_failed");
});

test("Albanian passive and completed-action fabrications are rejected", () => {
  const fx = fixture("a-albanian-services.json");
  for (const draft_reply of [
    "Faleminderit. Inspektimi është përfunduar.",
    "Faleminderit. Inspektimi u përfundua.",
    "Faleminderit. Pagesa u pranua.",
    "Faleminderit. U dërgua tekniku.",
    "Faleminderit. Tekniku është dërguar.",
    "Faleminderit. Termini është konfirmuar.",
    "Faleminderit. Është rezervuar dhe aranzhuar.",
  ]) assert.throws(
    () => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx),
    (error) => error.code === "validation_failed",
    draft_reply,
  );
});

test("invented price, contract, and payment claims fail when facts are absent", () => {
  const fx = fixture("f-price-contract.json");
  for (const draft_reply of [
    "Faleminderit. Çmimi është 50 EUR.",
    "Faleminderit. Kontrata është aktive.",
    "Thanks. Your payment has been confirmed.",
  ]) assert.throws(() => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx), (error) => error.code === "validation_failed");
});

test("secret requests, invented inspection results, and unsafe promises are rejected", () => {
  const fx = fixture("c-moisture-mold.json");
  for (const draft_reply of [
    "Ju lutem, na dërgo fjalëkalimin tuaj.",
    "Faleminderit. Inspektimi tregoi myk.",
    "Faleminderit. Garantojmë 100% se nuk ka rrezik.",
  ]) assert.throws(() => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx), (error) => error.code === "validation_failed");
});

test("risky electrical fixture remains cautious, high urgency, and human-reviewed", async () => {
  const fx = fixture("d-electrical-safety.json");
  const result = await inboxSpec.run(runtimeReturning(candidateFor(fx)), job(fx));
  assert.equal(result.intent, "electrical_concern");
  assert.equal(result.urgency, "high");
  assert.equal(result.requires_human_review, true);
  assert.match(result.draft_reply, /mos e prekni|elektricist/i);
  assert.throws(() => assertInboxCandidate(candidateFor(fx, { urgency: "low" }), fx), (error) => error.code === "validation_failed");
});

test("dangerous electrical instructions are rejected while cautious guidance passes", () => {
  const fx = fixture("d-electrical-safety.json");
  const safe = candidateFor(fx, {
    draft_reply: "Ju lutem, mos e prek telin dhe qëndroni larg. Kontaktoni një elektricist të kualifikuar.",
  });
  assert.doesNotThrow(() => assertInboxCandidate(safe, fx));
  for (const draft_reply of [
    "Keep away from the outlet, but touch the wire to check it and then call an electrician.",
    "Keep away from the outlet, but test the live wire and then call an electrician.",
    "Keep away from the outlet, but open the electrical panel and then call an electrician.",
    "Keep away from the outlet, but connect the wires yourself and then call an electrician.",
    "Qëndroni larg fillimisht, pastaj prek telin dhe kontaktoni një elektricist.",
    "Qëndroni larg fillimisht, pastaj provo telin me rrymë dhe kontaktoni një elektricist.",
    "Qëndroni larg fillimisht, pastaj hap panelin elektrik dhe kontaktoni një elektricist.",
    "Qëndroni larg fillimisht, pastaj lidhi telat vetë dhe kontaktoni një elektricist.",
  ]) assert.throws(() => assertInboxCandidate(candidateFor(fx, { draft_reply }), fx), (error) => error.code === "validation_failed");
});

test("live-looking compact IDs, wamids, opaque platform IDs, and formatted phones are rejected", () => {
  const fx = fixture("k-english-inquiry.json");
  for (const text of [
    "Please check reference 123e4567e89b42d3a456426614174000.",
    "Please check wamid.HBgMNTU1NTEyMzQ1Njc4FQIAERgSNkQ4RkYw.",
    "Please check meta_id: A1B2C3D4E5F6G7H8I9J0K1L2.",
    "Please call me at +355 69 123 4567.",
    "Please call me at +1-202-555-0123.",
  ]) {
    const messages = fx.messages.map((message, index) => index === 0 ? { ...message, text } : message);
    assert.throws(() => assertSyntheticInboxFixture({ ...fx, messages }), (error) => error.code === "authority_blocked");
  }
});

test("unclear request asks for clarification and preserves human review", async () => {
  const fx = fixture("e-unclear-request.json");
  const result = await inboxSpec.run(runtimeReturning(candidateFor(fx)), job(fx, "inbox.triage"));
  assert.equal(result.intent, "clarification_needed");
  assert.match(result.draft_reply, /\?/);
  assert.equal(result.requires_human_review, true);
});

test("Albanian draft is natural and concise; English fixture is not forced into Albanian", async () => {
  const sq = fixture("a-albanian-services.json");
  const sqResult = await inboxSpec.run(runtimeReturning(candidateFor(sq)), job(sq));
  assert.match(sqResult.draft_reply, /Faleminderit|Mund/i);
  assert.ok(sqResult.draft_reply.length < 300);

  const en = fixture("k-english-inquiry.json");
  const enResult = await inboxSpec.run(runtimeReturning(candidateFor(en)), job(en));
  assert.equal(enResult.language, "en");
  assert.match(enResult.draft_reply, /^Thanks/);
  assert.doesNotMatch(enResult.draft_reply, /Faleminderit|Përshëndetje/);
});

test("model/provider failure yields no fabricated result", async () => {
  const fx = fixture("a-albanian-services.json");
  const runtime = runtimeReturning(candidateFor(fx));
  runtime.llm.chat = async () => {
    const error = new Error("synthetic provider outage");
    error.code = "provider_5xx";
    throw error;
  };
  await assert.rejects(() => inboxSpec.run(runtime, job(fx)), (error) => error.code === "provider_5xx");
});

test("invalid model JSON and schema mismatch fail closed", async () => {
  const fx = fixture("a-albanian-services.json");
  await assert.rejects(() => inboxSpec.run(runtimeReturning("not-json"), job(fx)), (error) => error.code === "schema_invalid");
  await assert.rejects(() => inboxSpec.run(runtimeReturning({ ok: true }), job(fx)), /fields invalid/);
});

test("all eleven controlled fixtures are synthetic, identifier-free, and prompt-bounded", () => {
  const names = fs.readdirSync(FIXTURE_ROOT).filter((name) => name.endsWith(".json")).sort();
  assert.equal(names.length, 11);
  for (const name of names) {
    const fx = assertSyntheticInboxFixture(fixture(name));
    assert.ok(Buffer.byteLength(buildInboxPrompt(fx), "utf8") <= 16 * 1024);
  }
});

test("Inbox routing stays in P0-P4: light, cheap-first triage, K2.7 draft, no routine Codex/K3", () => {
  assert.equal(inboxSpec.resourceClass, "light");
  const triageJob = { job_type: "inbox.triage", payload: { conversation_fixture: fixture("a-albanian-services.json") } };
  const draftJob = { job_type: "inbox.draft", payload: { conversation_fixture: fixture("a-albanian-services.json") } };
  assert.equal(routeJob(triageJob, classifyJob(triageJob), DEFAULT_MODEL_CONFIG).handle, "opencode/qwen3.7-plus");
  assert.equal(routeJob(draftJob, classifyJob(draftJob), DEFAULT_MODEL_CONFIG).handle, "opencode/kimi-k2.7-code");
});

test("no production messaging path or mutation tool is reachable from Inbox Agent V1", () => {
  const source = fs.readFileSync(path.resolve("scripts/gmk-agent-worker/agents/inbox.spec.mjs"), "utf8");
  assert.deepEqual(inboxSpec.tools, []);
  assert.doesNotMatch(source, /lib\/messaging\/send|sendMetaMessage|sendReply|supabase\.from|\.rpc\(/);
  assert.match(source, /requires_human_review must be true/);
});

test("P5 remains fixture-only when P6 Overnight Mode is explicitly available", () => {
  const coordinator = fs.readFileSync(path.resolve("scripts/gmk-agent-worker/coordinator.mjs"), "utf8");
  assert.match(coordinator, /arg === "--overnight"/);
  assert.match(coordinator, /requires explicit --once or --overnight activation/);
  assert.doesNotMatch(coordinator, /sendMetaMessage|lib\/messaging\/send/);
  assert.throws(() => assertJobAuthority({
    job_type: "inbox.inspect",
    requires_review: true,
    payload: { conversation_fixture: fixture("a-albanian-services.json") },
  }), (error) => error.code === "authority_blocked");
});

test("Inbox prompt makes array field shapes explicit", () => {
  const source = fs.readFileSync(
    path.resolve("scripts/gmk-agent-worker/agents/inbox.spec.mjs"),
    "utf8",
  );

  assert.match(
    source,
    /customer_needs must be a JSON array containing 1-5 non-empty strings/,
  );
  assert.match(
    source,
    /risk_flags and uncertainty_flags must always be JSON arrays/,
  );
  assert.match(source, /Concrete JSON shape example/);
  assert.match(source, /if \(key === "customer_needs"\) return \[key, \["One specific customer need\."\]\]/);
  assert.match(source, /if \(key === "decision_evidence"\) return \[key, \["Observable reason from the fixture text\."\]\]/);
  assert.match(source, /if \(key === "send"\) return \[key, false\]/);
  assert.match(source, /if \(key === "requires_human_review"\) return \[key, true\]/);
});
