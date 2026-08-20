// JSON coercion/parsing helpers (ported from the reference inspection worker).

export function cleanJsonText(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function parseJsonLoose(text) {
  const cleaned = cleanJsonText(text);
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Coerce a value to a plain object (never an array/null).
export function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
