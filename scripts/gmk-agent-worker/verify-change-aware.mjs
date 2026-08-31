// Deterministic, zero-I/O verification of change-aware attribution policy.

import { DEPENDENCIES, KNOWN_GLOBAL_PATHS, MODULES } from "./agents/strehe-map.mjs";
import { mapModuleImpact, selectChecksForFiles } from "./lib/impact.mjs";

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

{
  const changed = [{ status: "M", path: "scripts/gmk-agent-worker/lib/tools.mjs" }];
  const impact = mapModuleImpact(changed, MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("A: GMK Agent Worker directly affected", impact.directly_affected.includes("GMK Agent Worker"), impact.directly_affected.join(","));
  check("A: only one directly affected module", impact.directly_affected.length === 1, `direct=${impact.directly_affected.length}`);
  check("A: Agent operator controls dependency affected",
    impact.dependency_affected.length === 1 && impact.dependency_affected[0] === "Agent operator controls",
    impact.dependency_affected.join(","));
  check("A: application modules carried forward",
    ["Auth / RBAC", "Messaging ingestion", "Billing / Invoicing", "CRM / Leads"].every((name) => impact.carried_forward.includes(name)));
  check("A: 22 carried forward", impact.carried_forward.length === 22, `cf=${impact.carried_forward.length}`);
  check("A: 2 deferred", impact.deferred.length === 2, impact.deferred.join(","));
  const checks = selectChecksForFiles(changed);
  check("A: node.check selected for .mjs", checks.length === 1 && checks[0].kind === "node.check" && checks[0].runnable === true, JSON.stringify(checks));
}

{
  const changedAuth = [{ status: "M", path: "lib/auth/roles.ts" }];
  const authImpact = mapModuleImpact(changedAuth, MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("B1: Auth / RBAC directly affected", authImpact.directly_affected.includes("Auth / RBAC"));
  check("B1: auth dependents become STALE",
    ["CRM / Leads", "Operator Inbox", "Billing / Invoicing", "GMK Agent Worker"].every((name) => authImpact.dependency_affected.includes(name)),
    authImpact.dependency_affected.join(","));
  const authChecks = selectChecksForFiles(changedAuth);
  check("B1: .ts typecheck flagged not-runnable", authChecks[0]?.kind === "npm.typecheck" && authChecks[0]?.runnable === false);

  const changedInfra = [{ status: "M", path: "supabase/migrations/20990101000000_example.sql" }];
  const infraImpact = mapModuleImpact(changedInfra, MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("B2: Supabase infra directly affected", infraImpact.directly_affected.includes("Supabase infra"));
  check("B2: messaging ingestion STALE via infra", infraImpact.dependency_affected.includes("Messaging ingestion"));
  check("B2: agent framework STALE via infra", infraImpact.dependency_affected.includes("Agent framework (DB substrate)"));
  check("B2: infra invalidation is bounded", infraImpact.carried_forward.length > 0, `cf=${infraImpact.carried_forward.length}`);
  const infraChecks = selectChecksForFiles(changedInfra);
  check("B2: .sql migration.review flagged not-runnable", infraChecks[0]?.kind === "migration.review" && infraChecks[0]?.runnable === false);
}

{
  const impact = mapModuleImpact([], MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("C: no directly affected", impact.directly_affected.length === 0);
  check("C: no dependency affected", impact.dependency_affected.length === 0);
  check("C: all 24 active modules carried forward", impact.carried_forward.length === 24, `cf=${impact.carried_forward.length}`);
  check("C: no checks selected", selectChecksForFiles([]).length === 0);
}

{
  const changed = [
    "app/operator/agents/AgentControlButton.tsx",
    "app/operator/agents/actions.ts",
    "app/operator/agents/page.tsx",
    "lib/agents/operator-view.ts",
    "tests/unit/agent-operator.spec.ts",
  ].map((path) => ({ status: "M", path }));
  const impact = mapModuleImpact(changed, MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("D: Agent operator controls directly affected", impact.directly_affected.includes("Agent operator controls"), impact.directly_affected.join(","));
  check("D: Operator Inbox is not misclassified", !impact.directly_affected.includes("Operator Inbox"), impact.directly_affected.join(","));
  check("D: all operator control paths mapped", impact.unmapped_paths.length === 0, impact.unmapped_paths.join(","));
}

{
  const impact = mapModuleImpact([{ status: "M", path: "unmapped-global.config" }], MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("E: unexpected unmapped path is explicit", impact.unmapped_paths.length === 1 && impact.unmapped_paths[0] === "unmapped-global.config");
}

{
  const impact = mapModuleImpact([
    { status: "M", path: "package.json" },
    { status: "M", path: "tests/fixtures/inbox/a-albanian-services.json" },
  ], MODULES, DEPENDENCIES, KNOWN_GLOBAL_PATHS);
  check("F: known global paths are explicit", impact.known_global_paths.length === 2, impact.known_global_paths.join(","));
  check("F: known global paths are not unexpected unmapped", impact.unmapped_paths.length === 0, impact.unmapped_paths.join(","));
}

const failed = results.filter((result) => !result).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
