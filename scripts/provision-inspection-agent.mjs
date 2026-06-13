import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const AGENT_EMAIL = "agent_photo-comp@streheprona.com";
const AGENT_KEY = "inspection.local";
const CAPABILITY = "inspection.photo.compare";

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
  throw new Error("Inspection agent lookup exceeded the paging limit.");
}

const appRoot = process.cwd();
const appEnv = readEnv(path.join(appRoot, ".env.local"));
const supabaseUrl = appEnv.get("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = appEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = appEnv.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("The hosted app .env.local is missing Supabase credentials.");
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

const { error: appProfileError } = await admin
  .from("app_users")
  .delete()
  .eq("id", authUser.id);
if (appProfileError) throw appProfileError;

const { error: principalError } = await admin.from("agent_principals").upsert({
  id: authUser.id,
  agent_key: AGENT_KEY,
  display_name: "Local Inspection Comparison Agent",
  description:
    "Compares expiring room-photo copies on the household PC with deterministic checks and a local GPU vision model.",
  is_active: true,
});
if (principalError) throw principalError;

const { error: staleCapabilitiesError } = await admin
  .from("agent_capabilities")
  .delete()
  .eq("agent_id", authUser.id)
  .neq("capability_key", CAPABILITY);
if (staleCapabilitiesError) throw staleCapabilitiesError;

const { error: capabilityError } = await admin
  .from("agent_capabilities")
  .upsert(
    {
      agent_id: authUser.id,
      capability_key: CAPABILITY,
      constraints: {
        job_types: [CAPABILITY],
        input_scope: "temporary_private_artifacts",
        result_scope: "comparison_only",
        public_ai_apis: false,
        local_gpu_preferred: true,
        quality_checks: ["schema", "image-pairs", "privacy", "usefulness"],
        max_quality_attempts: 3,
        human_review_required: true,
      },
    },
    { onConflict: "agent_id,capability_key" }
  );
if (capabilityError) throw capabilityError;

const localEnvPath = path.join(appRoot, ".env.inspection-agent.local");
let localEnv = fs.existsSync(localEnvPath)
  ? fs.readFileSync(localEnvPath, "utf8")
  : "";
localEnv = setEnvValue(localEnv, "SUPABASE_URL", supabaseUrl);
localEnv = setEnvValue(localEnv, "SUPABASE_ANON_KEY", anonKey);
localEnv = setEnvValue(localEnv, "SUPABASE_AGENT_EMAIL", AGENT_EMAIL);
localEnv = setEnvValue(localEnv, "SUPABASE_AGENT_PASSWORD", password);
localEnv = setEnvValue(localEnv, "OLLAMA_BASE_URL", "http://127.0.0.1:11434");
localEnv = setEnvValue(localEnv, "OLLAMA_MODEL", "qwen3.5:2b");
localEnv = setEnvValue(localEnv, "INSPECTION_WORKER_POLL_SECONDS", "10");
fs.writeFileSync(localEnvPath, localEnv, "utf8");

console.log(`Provisioned ${AGENT_KEY} with ${CAPABILITY}.`);
console.log(`Wrote local runtime credentials to ${localEnvPath}.`);
