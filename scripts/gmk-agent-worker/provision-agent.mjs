import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./lib/env.mjs";
import { storeCredential } from "./lib/credential.mjs";

// One-time offline provisioning (service_role). Creates a genuine Supabase Auth
// agent identity: auth user -> remove auto-created app_users -> agent_principals ->
// capability. Stores the password in Windows Credential Manager and writes a local
// env file that contains NO secret. Run manually, never from the worker runtime.

const AGENT_DEFAULTS = {
  engineering: {
    email: "agent.engineering@streheprona.com",
    key: "engineering.local",
    capability: "engineering.local",
    displayName: "Local Engineering Agent",
    description: "Local read/analyze/test engineering support for the STREHË repository.",
    model: "deepseek-coder-v2:16b",
    runtimeRoot: "D:\\Personal\\Projects\\Strehe-Prona\\STREHE-ENGINEERING-RUNTIME",
    worktreePath: "D:\\Personal\\Projects\\Strehe-Prona\\STREHE-ENGINEERING-RUNTIME\\worktree\\strehe-app-engineering",
  },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--") && a.includes("=")) {
      const [k, v] = a.slice(2).split("=");
      args[k] = v;
    } else if (a.startsWith("--") && argv[i + 1]) {
      args[a.slice(2)] = argv[++i];
    }
  }
  return args;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((c) => c.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("agent user lookup exceeded the paging limit");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const agent = a.agent || "engineering";
  const defaults = AGENT_DEFAULTS[agent] || {};
  const email = a.email || defaults.email;
  const key = a.key || defaults.key;
  const capability = a.capability || defaults.capability;
  const displayName = a["display-name"] || defaults.displayName || `Local ${agent} Agent`;
  const description = a.description || defaults.description || "Local STREHË agent.";
  const credentialTarget = a["credential-target"] || `strehe-agent-${agent}`;
  const model = a.model || defaults.model || "deepseek-coder-v2:16b";
  const runtimeRoot = a["runtime-root"] || defaults.runtimeRoot || "";
  const worktreePath = a["worktree-path"] || defaults.worktreePath || "";
  const source = a.source || path.resolve(process.cwd(), "..", "strehe-app", ".env.local");
  const envOut = a["env-out"] || path.resolve(process.cwd(), `.env.gmk-${agent}.local`);

  if (!email || !key || !capability) throw new Error("email/key/capability are required");

  const sourceEnv = readEnv(source);
  const supabaseUrl = sourceEnv.get("NEXT_PUBLIC_SUPABASE_URL") || sourceEnv.get("SUPABASE_URL");
  const anonKey = sourceEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || sourceEnv.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = sourceEnv.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(`source env ${source} is missing Supabase credentials`);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const password = crypto.randomBytes(36).toString("base64url");

  let authUser = await findUserByEmail(admin, email);
  if (authUser) {
    const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      user_metadata: { identity_type: "agent", agent_key: key },
    });
    if (error) throw error;
    authUser = data.user;
    console.log(`Updated existing auth user ${email}.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { identity_type: "agent", agent_key: key },
    });
    if (error) throw error;
    authUser = data.user;
    console.log(`Created auth user ${email}.`);
  }

  // Agents must not be app_users (identity-boundary trigger enforces this).
  const { error: profileError } = await admin.from("app_users").delete().eq("id", authUser.id);
  if (profileError) throw profileError;

  const { error: principalError } = await admin.from("agent_principals").upsert({
    id: authUser.id,
    agent_key: key,
    display_name: displayName,
    description,
    is_active: true,
  });
  if (principalError) throw principalError;

  const { error: capError } = await admin
    .from("agent_capabilities")
    .upsert(
      {
        agent_id: authUser.id,
        capability_key: capability,
        constraints: {
          job_types: [capability],
          human_review_required: true,
          max_quality_attempts: 3,
        },
      },
      { onConflict: "agent_id,capability_key" },
    );
  if (capError) throw capError;

  storeCredential(credentialTarget, email, password);

  const lines = [
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_ANON_KEY=${anonKey}`,
    `SUPABASE_AGENT_EMAIL=${email}`,
    `GMK_CREDENTIAL_TARGET=${credentialTarget}`,
    `OLLAMA_BASE_URL=${a["ollama-url"] || "http://127.0.0.1:11434"}`,
    `OLLAMA_MODEL=${model}`,
    `GMK_POLL_SECONDS=${a["poll-seconds"] || "10"}`,
  ];
  if (runtimeRoot) lines.push(`GMK_RUNTIME_ROOT=${runtimeRoot}`);
  if (worktreePath) lines.push(`GMK_WORKTREE_PATH=${worktreePath}`);
  lines.push("");
  fs.writeFileSync(envOut, lines.join("\n"), "utf8");

  console.log(`Provisioned ${key} (${email}) with capability ${capability}.`);
  console.log(`Password stored in Credential Manager target "${credentialTarget}".`);
  console.log(`Env (no secret) written to ${envOut}.`);
}

main().catch((err) => {
  process.stderr.write(`provision failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
