import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const AGENT_EMAIL = "agent.finance@streheprona.com";
const AGENT_KEY = "finance.local";
const CAPABILITIES = [
  {
    capability_key: "finance.report.generate",
    constraints: {
      job_types: ["finance.report.generate"],
      result_scope: "aggregate_only",
      raw_finance_uploads: false,
      quality_checks: ["schema", "arithmetic", "privacy", "usefulness"],
      max_quality_attempts: 3,
      human_review_required: true,
    },
  },
  {
    capability_key: "finance.plan.propose",
    constraints: {
      job_types: ["finance.plan.propose"],
      result_scope: "aggregate_only",
      raw_finance_uploads: false,
      quality_checks: ["schema", "arithmetic", "privacy", "usefulness"],
      max_quality_attempts: 3,
      human_review_required: true,
    },
  },
];

function readEnv(filePath) {
  const values = new Map();
  if (!fs.existsSync(filePath)) return values;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    values.set(
      trimmed.slice(0, separator).trim(),
      trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "")
    );
  }
  return values;
}

function setEnvValue(text, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.trimEnd()}\n${line}\n`;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("Agent user lookup exceeded the paging limit.");
}

const appRoot = process.cwd();
const localRoot = path.resolve(
  process.argv[2] || "../strehe-finance-local"
);
const appEnv = readEnv(path.join(appRoot, ".env.local"));
const supabaseUrl = appEnv.get("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = appEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = appEnv.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("The hosted app .env.local is missing Supabase credentials.");
}
if (!fs.existsSync(localRoot)) {
  throw new Error(`Local finance project was not found: ${localRoot}`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = crypto.randomBytes(36).toString("base64url");
let authUser = await findUserByEmail(admin, AGENT_EMAIL);

if (authUser) {
  const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
    password,
    user_metadata: {
      identity_type: "agent",
      agent_key: AGENT_KEY,
    },
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: AGENT_EMAIL,
    password,
    email_confirm: true,
    user_metadata: {
      identity_type: "agent",
      agent_key: AGENT_KEY,
    },
  });
  if (error) throw error;
  authUser = data.user;
}

// The project's auth trigger creates an app_users row for every new auth
// identity. A dedicated agent must remove that profile before registration.
const { error: appProfileError } = await admin
  .from("app_users")
  .delete()
  .eq("id", authUser.id);
if (appProfileError) throw appProfileError;

const { error: principalError } = await admin.from("agent_principals").upsert({
  id: authUser.id,
  agent_key: AGENT_KEY,
  display_name: "Local Finance Agent",
  description:
    "Runs private expense intake, aggregate analysis, and planning workflows on the household PC.",
  is_active: true,
});
if (principalError) throw principalError;

const { error: capabilityError } = await admin
  .from("agent_capabilities")
  .upsert(
    CAPABILITIES.map((capability) => ({
      agent_id: authUser.id,
      ...capability,
    })),
    { onConflict: "agent_id,capability_key" }
  );
if (capabilityError) throw capabilityError;

const localEnvPath = path.join(localRoot, ".env");
const exampleEnvPath = path.join(localRoot, ".env.example");
let localEnv = fs.existsSync(localEnvPath)
  ? fs.readFileSync(localEnvPath, "utf8")
  : fs.readFileSync(exampleEnvPath, "utf8");
localEnv = setEnvValue(localEnv, "SUPABASE_URL", supabaseUrl);
localEnv = setEnvValue(localEnv, "SUPABASE_ANON_KEY", anonKey);
localEnv = setEnvValue(localEnv, "SUPABASE_AGENT_EMAIL", AGENT_EMAIL);
localEnv = setEnvValue(localEnv, "SUPABASE_AGENT_PASSWORD", password);
fs.writeFileSync(localEnvPath, localEnv, "utf8");

console.log(
  `Provisioned ${AGENT_KEY} with ${CAPABILITIES.map(
    (capability) => capability.capability_key
  ).join(", ")}.`
);
console.log(`Wrote agent runtime credentials to ${localEnvPath}.`);
