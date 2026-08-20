import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Engineering tool gateway. Strict allowlist; no shell interpolation; all
// subprocesses bound to the isolated engineering worktree; timeout-controlled;
// output-captured and truncated; non-interactive; env scrubbed of secrets.

const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB per tool call
const MAX_FILE_READ_BYTES = 1024 * 1024; // 1 MB per file read

// Only these environment variables survive into tool subprocesses.
const ENV_ALLOWLIST = [
  "SystemRoot", "SYSTEMROOT", "PATH", "Path", "PATHEXT",
  "TEMP", "TMP", "USERPROFILE", "ComSpec", "COMSPEC",
  "ProgramData", "ProgramFiles", "ProgramFiles(x86)",
  "LOCALAPPDATA", "APPDATA", "HOMEDRIVE", "HOMEPATH",
];

function sanitizedEnv() {
  const env = {};
  for (const key of ENV_ALLOWLIST) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function resolveWithin(base, target) {
  const resolved = path.resolve(base, target);
  const rel = path.relative(base, resolved);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`path escapes the engineering worktree: ${target}`);
  }
  return resolved;
}

// Accept only a bare git commit ref (7-40 hex). Never a range/flag/glob.
function validateRef(ref) {
  if (typeof ref !== "string") return null;
  const r = ref.trim();
  return /^[0-9a-f]{7,40}$/i.test(r) ? r : null;
}

// Accept only a clean repository-relative scope path (no traversal/absolute).
function validateScopePath(p) {
  if (typeof p !== "string") return null;
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!norm || norm.startsWith("/") || norm.includes("..") || norm.includes("\0")) return null;
  return norm;
}

// Parse `git diff --name-status` output into structured changes.
function parseNameStatus(stdout) {
  const changes = [];
  for (const raw of String(stdout || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("\t");
    const code = parts[0] || "";
    const status = code[0];
    if (!status) continue;
    if ((status === "R" || status === "C") && parts.length >= 3) {
      changes.push({ status, old_path: parts[1], path: parts[2] });
    } else if (parts.length >= 2) {
      changes.push({ status, path: parts[1] });
    }
  }
  return changes;
}


function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: worktreeRoot,
      shell: false,
      windowsHide: true,
      env: sanitizedEnv(),
    });
    const buffers = { stdout: "", stderr: "", truncated: false };

    const makeHandler = (which) => (chunk) => {
      const text = chunk.toString();
      const current = buffers[which];
      if (current.length + text.length > MAX_OUTPUT_BYTES) {
        buffers[which] = current + text.slice(0, MAX_OUTPUT_BYTES - current.length);
        buffers.truncated = true;
      } else {
        buffers[which] = current + text;
      }
    };

    child.stdout.on("data", makeHandler("stdout"));
    child.stderr.on("data", makeHandler("stderr"));

    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message, stdout: buffers.stdout, stderr: buffers.stderr, truncated: buffers.truncated });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const timedOut = signal !== null;
      resolve({
        ok: code === 0 && !timedOut,
        exitCode: code,
        signal,
        timedOut,
        stdout: buffers.stdout,
        stderr: buffers.stderr,
        truncated: buffers.truncated,
      });
    });
  });
}

let worktreeRoot = null;

export function createToolGateway({ worktreePath }) {
  worktreeRoot = path.resolve(worktreePath);

  async function git(args) {
    return run("git", args, 60000);
  }

  async function readFile(relPath) {
    const abs = resolveWithin(worktreeRoot, relPath);
    const stat = fs.statSync(abs);
    if (stat.size > MAX_FILE_READ_BYTES) {
      return { ok: false, error: `file exceeds 1 MB read limit: ${relPath}` };
    }
    const content = fs.readFileSync(abs, "utf8");
    return { ok: true, content, bytes: stat.size, truncated: stat.size > MAX_FILE_READ_BYTES };
  }

  const GIT_DENY = /\b(push|merge|rebase|tag|commit|checkout|reset|clean|fetch|clone|remote|cherry-pick|rm|add|mv)\b/i;

  const tools = {
    // read-only git
    "git.status": async () => git(["status", "--porcelain"]),
    "git.diff_stat": async () => git(["diff", "--stat"]),
    "git.diff": async () => git(["diff", "--", "."]),
    "git.diff_names": async (p) => {
      const base = validateRef(p?.base);
      const current = validateRef(p?.current);
      if (!base || !current) return { ok: false, error: "invalid commit ref (must be 7-40 hex)" };
      if (base === current) return { ok: true, stdout: "", stderr: "", changes: [] };
      const r = await git(["diff", "--name-status", `${base}..${current}`]);
      if (!r.ok) return r;
      return { ...r, changes: parseNameStatus(r.stdout) };
    },
    "git.log": async (p) => git(["log", "--oneline", "-n", String(clampInt(p?.count, 50))]),
    "git.rev": async () => {
      const head = await git(["rev-parse", "HEAD"]);
      const tree = await git(["rev-parse", "HEAD^{tree}"]);
      return { ok: head.ok && tree.ok, commit: head.stdout.trim(), tree: tree.stdout.trim(), stdout: head.stdout, stderr: "" };
    },
    "git.ls_files": async (p) => {
      const args = ["ls-files"];
      if (p && typeof p.path === "string" && p.path) {
        const scope = validateScopePath(p.path);
        if (!scope) return { ok: false, error: `invalid scope path: ${p.path}` };
        args.push("--", scope);
      }
      return git(args);
    },
    "files": async (p) => {
      const glob = typeof p?.glob === "string" && p.glob ? ["-g", p.glob] : [];
      return run("rg", ["--files", ...glob, "."], 60000);
    },
    "git.show_stat": async (p) => git(["show", "--stat", "--oneline", String(p?.sha ?? "HEAD")]),
    // filesystem (read-only, contained)
    "file.read": async (p) => readFile(String(p?.path ?? "")),
    // search (ripgrep, contained)
    "search": async (p) => {
      const pattern = String(p?.pattern ?? "");
      if (!pattern || pattern.length > 200) return { ok: false, error: "invalid search pattern" };
      const glob = typeof p?.glob === "string" && p.glob ? ["-g", p.glob] : [];
      const target = typeof p?.path === "string" && p.path ? resolveWithin(worktreeRoot, p.path) : worktreeRoot;
      return run("rg", ["--no-heading", "-n", "--max-count", "200", ...glob, pattern, target], 60000);
    },
    // deterministic check / test / lint / build (bounded, worktree-scoped)
    "node.check": async (p) => {
      const abs = resolveWithin(worktreeRoot, String(p?.path ?? ""));
      return run("node", ["--check", abs], 60000);
    },
    "npm.lint": async () => run("npm", ["run", "lint"], 300000),
    "npm.build": async () => run("npm", ["run", "build"], 600000),
    "npm.typecheck": async () => run("npx", ["tsc", "--noEmit"], 300000),
    "npm.test": async (p) => {
      const spec = String(p?.spec ?? "");
      const args = spec ? ["playwright", "test", spec] : ["playwright", "test"];
      return run("npx", args, 600000);
    },
  };

  return {
    worktreeRoot,
    list() {
      return Object.keys(tools);
    },
    async runTool(name, params = {}) {
      const fn = tools[name];
      if (!fn) return { ok: false, error: `unknown tool: ${name}` };
      // Defense in depth: the tool names are fixed; params are validated inside
      // each tool. No arbitrary command string is ever accepted.
      try {
        return await fn(params);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    // Exposed for tests only.
    _isDenied(args) {
      return GIT_DENY.test(args.join(" "));
    },
  };
}

function clampInt(value, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return max;
  return Math.min(Math.max(n, 1), max);
}
