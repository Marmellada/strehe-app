import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyProactiveRecovery, writeRecoveryManifest } from "./lib/proactive-recovery.mjs";

function parseArgs(argv) {
  let dryRun = false;
  let runtimeRoot = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--runtime-root" && argv[index + 1]) runtimeRoot = argv[++index];
    else if (arg.startsWith("--runtime-root=")) runtimeRoot = arg.slice("--runtime-root=".length);
    else throw new Error(`unsupported recovery argument: ${arg}`);
  }
  if (!dryRun) throw new Error("Only --dry-run is supported; production recovery requires the authenticated operator action.");
  return { runtimeRoot };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoPath = path.resolve(scriptDir, "..", "..");
const args = parseArgs(process.argv.slice(2));
const runtimeRoot = path.resolve(args.runtimeRoot || path.join(repoPath, "..", ".."));
const dbPath = path.join(runtimeRoot, "state", "engineering.sqlite3");
const manifest = verifyProactiveRecovery({ dbPath, repoPath });
const artifactPath = writeRecoveryManifest(runtimeRoot, manifest);
console.log(JSON.stringify({ ok: true, mode: "dry-run", artifact_path: artifactPath, recovery_rpc_payload: manifest.recovery_rpc_payload }, null, 2));
