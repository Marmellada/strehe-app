// Output/privacy validation shared across all agents.

// Raw-input reference keys that must never appear in a persisted result.
const FORBIDDEN_KEYS = [
  "storage_path",
  "signed_url",
  "image_bytes",
  "base64",
  "source_photo_id",
];

// Secret markers scanned in the serialized result (defense in depth).
const SECRET_PATTERNS = [
  /service[_\-]?role/i,
  /eyJhbGciOi[A-Za-z0-9._-]{12,}/, // JWT
  /\bsk-[A-Za-z0-9]{16,}/, // OpenAI-style keys
  /\bgh[pousr]_[A-Za-z0-9]{16,}/, // GitHub tokens
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function forbiddenKeys(value, currentPath = "") {
  const matches = [];
  if (!value || typeof value !== "object") return matches;
  for (const [key, child] of Object.entries(value)) {
    const path = currentPath ? `${currentPath}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(key)) matches.push(path);
    matches.push(...forbiddenKeys(child, path));
  }
  return matches;
}

export function assertNoForbiddenKeys(value) {
  const found = forbiddenKeys(value);
  if (found.length > 0) {
    throw new Error(`forbidden raw input references found: ${found.join(", ")}`);
  }
  return value;
}

export function assertNoSecrets(value) {
  const serialized = JSON.stringify(value ?? null);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(`result contains a disallowed secret-like value (${pattern})`);
    }
  }
  return value;
}

// Privacy block invariant: every agent result must assert local-only processing.
export function assertPrivacyBlock(result) {
  const privacy = result?.privacy ?? {};
  if (privacy.external_ai_used !== false || privacy.local_processing !== true) {
    throw new Error("privacy boundary is incomplete");
  }
  return result;
}

// Full result gate: privacy + no secrets + no raw-input references.
export function assertSafeResult(result) {
  assertPrivacyBlock(result);
  assertNoSecrets(result);
  assertNoForbiddenKeys(result);
  return result;
}
