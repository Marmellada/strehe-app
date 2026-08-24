import path from "node:path";
import { openDatabase } from "../lib/sqlite.mjs";

function runtimeRootFromArgs(argv) {
  const index = argv.indexOf("--runtime-root");
  if (index >= 0 && argv[index + 1]) return path.resolve(argv[index + 1]);
  const inline = argv.find((arg) => arg.startsWith("--runtime-root="));
  return inline ? path.resolve(inline.slice("--runtime-root=".length)) : process.env.GMK_RUNTIME_ROOT;
}

const runtimeRoot = runtimeRootFromArgs(process.argv.slice(2));
if (!runtimeRoot) {
  process.stderr.write("usage: node router-usage-report.mjs --runtime-root <path>\n");
  process.exit(2);
}

const { db } = openDatabase(runtimeRoot);
try {
  const windows = [
    ["rolling_5h", "-5 hours"],
    ["rolling_7d", "-7 days"],
    ["rolling_30d", "-30 days"],
  ];
  const report = {};
  for (const [name, modifier] of windows) {
    report[name] = db.prepare(
      `SELECT provider, model, COUNT(*) AS calls,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
              COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens,
              COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
       FROM llm_usage_ledger
       WHERE created_at >= datetime('now', ?)
       GROUP BY provider, model
       ORDER BY provider, model`,
    ).all(modifier);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  db.close();
}
