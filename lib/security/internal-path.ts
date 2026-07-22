const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

export function getSafeInternalPath(
  value: string | null | undefined
) {
  const fallback = "/dashboard";

  if (!value) {
    return "/dashboard";
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return fallback;
  }

  let decoded = value;

  try {
    for (let pass = 0; pass < 16; pass += 1) {
      if (ENCODED_PATH_SEPARATOR.test(decoded)) {
        return fallback;
      }

      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      if (pass === 15) return fallback;
      decoded = nextDecoded;
    }
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    CONTROL_CHARACTERS.test(decoded) ||
    ENCODED_PATH_SEPARATOR.test(decoded)
  ) {
    return fallback;
  }

  return value;
}
