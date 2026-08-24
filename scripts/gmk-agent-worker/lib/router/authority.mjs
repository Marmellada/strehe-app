const FORBIDDEN_TRUE_KEYS = new Set([
  "send", "deploy", "push", "force_push", "apply_migration", "migrate",
  "rotate_secret", "rotate_secrets", "change_billing", "production_write",
]);

const FORBIDDEN_ACTION = /\b(send|deploy|push|force[-_ ]?push|apply[-_ ]?migration|rotate[-_ ]?secret|change[-_ ]?billing|production[-_ ]?(write|mutation))\b/i;

function inspect(value, path = "payload") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) inspect(value[index], `${path}[${index}]`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_TRUE_KEYS.has(key) && child !== false && child != null && child !== "") {
      const error = new Error(`forbidden unattended authority requested at ${childPath}`);
      error.code = "authority_blocked";
      throw error;
    }
    if (["action", "command", "operation", "intent"].includes(key)
      && typeof child === "string" && FORBIDDEN_ACTION.test(child)) {
      const error = new Error(`forbidden unattended action requested at ${childPath}`);
      error.code = "authority_blocked";
      throw error;
    }
    inspect(child, childPath);
  }
}

export function assertJobAuthority(job) {
  const payload = job?.payload && typeof job.payload === "object" ? job.payload : {};
  if (String(job?.job_type || "").startsWith("inbox.") && payload.conversation_id) {
    const error = new Error("Inbox V1 accepts fixtures only; real conversation_id is forbidden");
    error.code = "authority_blocked";
    throw error;
  }
  inspect(payload);
  return true;
}
