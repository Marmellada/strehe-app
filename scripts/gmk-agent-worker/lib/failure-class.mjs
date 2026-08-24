const FAILURE_CLASS_PATTERN = /^[a-z][a-z0-9_]{0,119}$/;

export function deterministicFailureClass(error, fallback = "agent_processing_failed") {
  const code = error && typeof error === "object" ? error.code : null;
  return typeof code === "string" && FAILURE_CLASS_PATTERN.test(code)
    ? code
    : fallback;
}

export function parseFatalFailureClass(output, source) {
  const escaped = String(source).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(output || "").match(new RegExp(`(?:^|\\r?\\n)${escaped} fatal \\[([a-z][a-z0-9_]{0,119})\\]:`, "m"));
  return match?.[1] || null;
}
