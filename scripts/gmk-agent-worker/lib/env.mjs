import fs from "node:fs";

// Minimal env-file loader (ported from the reference inspection worker).
// Reads KEY=VALUE lines; ignores comments and blank lines; strips quotes.
export function readEnv(filePath) {
  const values = new Map();
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep < 1) continue;
    values.set(
      trimmed.slice(0, sep).trim(),
      trimmed.slice(sep + 1).trim().replace(/^['"]|['"]$/g, ""),
    );
  }
  return values;
}

export function requireValue(values, key) {
  const value = values.get(key) ?? process.env[key];
  if (!value) throw new Error(`Missing ${key} in the agent environment.`);
  return value;
}
