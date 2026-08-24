export function redactSensitiveText(value, max = 1200) {
  return String(value ?? "unknown")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|authorization|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/[\u0000-\u001f]/g, " ")
    .slice(0, max);
}
