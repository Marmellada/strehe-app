// Pure, deterministic module-impact mapping over a system map + dependency graph.
// No I/O, no git, no secrets — unit-testable. Consumed by the change-aware review.

function norm(p) {
  return String(p ?? "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

// Does a changed file fall under (or equal) one of the module's source_paths?
export function fileMatchesModule(file, module) {
  const f = norm(file);
  if (!f) return false;
  for (const raw of module.source_paths || []) {
    const prefix = norm(raw);
    if (!prefix || prefix === ".." || prefix.startsWith("../")) continue; // outside-worktree refs never match repo files
    if (f === prefix || f.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

// Directly-affected modules = active modules whose source_paths match a changed file.
export function directModules(changedFiles, modules) {
  const names = new Set();
  for (const ch of changedFiles) {
    for (const m of modules) {
      if (m.category === "post-v1") continue;
      if (fileMatchesModule(ch.path, m)) names.add(m.name);
    }
  }
  return [...names].sort();
}

// Transitive downstream dependents: edge [from, to] means "to depends on from",
// so a change in `from` invalidates `to` (and transitively its dependents).
export function downstreamModules(direct, dependencies) {
  const result = new Set();
  const queue = [...direct];
  const seen = new Set(direct);
  while (queue.length) {
    const cur = queue.pop();
    for (const [from, to] of dependencies) {
      if (from === cur && !seen.has(to)) {
        seen.add(to);
        result.add(to);
        queue.push(to);
      }
    }
  }
  return [...result].sort();
}

export function mapModuleImpact(changedFiles, modules, dependencies) {
  const active = modules.filter((m) => m.category !== "post-v1");
  const deferred = modules.filter((m) => m.category === "post-v1").map((m) => m.name);
  const direct = directModules(changedFiles, active);
  const downstream = downstreamModules(direct, dependencies);
  const dependencyAffected = downstream.filter((n) => !direct.includes(n));
  const affected = new Set([...direct, ...dependencyAffected]);
  const carriedForward = active.filter((m) => !affected.has(m.name)).map((m) => m.name);
  return {
    directly_affected: direct,
    dependency_affected: dependencyAffected,
    carried_forward: carriedForward,
    deferred,
  };
}

const NODE_EXT = new Set([".mjs", ".js", ".cjs"]);
const TS_EXT = new Set([".ts", ".tsx"]);

// Deterministic check selection per changed file. `runnable` marks whether the
// isolated worktree can execute it (node --check only; no node_modules there).
export function selectChecksForFiles(changedFiles) {
  const checks = [];
  for (const ch of changedFiles) {
    const p = norm(ch.path);
    const dot = p.lastIndexOf(".");
    const ext = dot >= 0 ? p.slice(dot).toLowerCase() : "";
    if (NODE_EXT.has(ext)) {
      checks.push({ kind: "node.check", description: `syntax check ${p}`, params: { path: p }, runnable: true });
    } else if (TS_EXT.has(ext)) {
      checks.push({ kind: "npm.typecheck", description: `typecheck ${p}`, params: { path: p }, runnable: false });
    } else if (ext === ".sql") {
      checks.push({ kind: "migration.review", description: `migration review ${p}`, params: { path: p }, runnable: false });
    }
    // else: docs/config/data (.json/.md/.toml/.yml) — no deterministic check.
  }
  return checks;
}
