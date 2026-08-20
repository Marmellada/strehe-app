// verify-change-aware.mjs — deterministic verification of change-aware review:
//   Case A — isolated runtime file change → only GMK Agent Worker affected
//   Case B — shared/high-impact change → downstream modules become STALE
//   Case C — no change → no invalidation, validations carried forward
// Pure (no git/ollama/supabase); imports the real map + impact module.

import { MODULES, DEPENDENCIES } from "./agents/strehe-map.mjs";
import { mapModuleImpact, selectChecksForFiles } from "./lib/impact.mjs";

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

// ---- Case A: isolated Engineering-runtime file change ----
{
  const changed = [{ status: "M", path: "scripts/gmk-agent-worker/lib/tools.mjs" }];
  const impact = mapModuleImpact(changed, MODULES, DEPENDENCIES);
  check("A: GMK Agent Worker directly affected", impact.directly_affected.includes("GMK Agent Worker"), impact.directly_affected.join(","));
  check("A: only one directly affected module", impact.directly_affected.length === 1, `direct=${impact.directly_affected.length}`);
  check("A: no dependency affected", impact.dependency_affected.length === 0, impact.dependency_affected.join(","));
  check("A: application modules carried forward",
    ["Auth / RBAC", "Messaging ingestion", "Billing / Invoicing", "CRM / Leads"].every((n) => impact.carried_forward.includes(n)));
  check("A: 22 carried forward", impact.carried_forward.length === 22, `cf=${impact.carried_forward.length}`);
  check("A: 2 deferred", impact.deferred.length === 2, impact.deferred.join(","));
  const checks = selectChecksForFiles(changed);
  check("A: node.check selected for .mjs", checks.length === 1 && checks[0].kind === "node.check" && checks[0].runnable === true, JSON.stringify(checks));
}

// ---- Case B: shared / high-impact change ----
{
  const changedAuth = [{ status: "M", path: "lib/auth/roles.ts" }];
  const ia = mapModuleImpact(changedAuth, MODULES, DEPENDENCIES);
  check("B1: Auth / RBAC directly affected", ia.directly_affected.includes("Auth / RBAC"));
  check("B1: auth dependents become STALE (dependency affected)",
    ["CRM / Leads", "Operator Inbox", "Billing / Invoicing", "GMK Agent Worker"].every((n) => ia.dependency_affected.includes(n)),
    ia.dependency_affected.join(","));
  const ac = selectChecksForFiles(changedAuth);
  check("B1: .ts typecheck flagged not-runnable", ac[0]?.kind === "npm.typecheck" && ac[0]?.runnable === false);

  const changedInfra = [{ status: "M", path: "supabase/migrations/20990101000000_example.sql" }];
  const ii = mapModuleImpact(changedInfra, MODULES, DEPENDENCIES);
  check("B2: Supabase infra directly affected", ii.directly_affected.includes("Supabase infra"));
  check("B2: messaging ingestion STALE via infra", ii.dependency_affected.includes("Messaging ingestion"));
  check("B2: agent framework STALE via infra", ii.dependency_affected.includes("Agent framework (DB substrate)"));
  check("B2: infra change invalidates many (not whole app): carried-forward stays non-empty", ii.carried_forward.length > 0, `cf=${ii.carried_forward.length}`);
  const ic = selectChecksForFiles(changedInfra);
  check("B2: .sql migration.review flagged not-runnable", ic[0]?.kind === "migration.review" && ic[0]?.runnable === false);
}

// ---- Case C: no change ----
{
  const impact = mapModuleImpact([], MODULES, DEPENDENCIES);
  check("C: no directly affected", impact.directly_affected.length === 0);
  check("C: no dependency affected", impact.dependency_affected.length === 0);
  check("C: all 23 active modules carried forward", impact.carried_forward.length === 23, `cf=${impact.carried_forward.length}`);
  check("C: no checks selected", selectChecksForFiles([]).length === 0);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
