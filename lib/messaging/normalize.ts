// Pure phone/identity normalization helpers. No database access.

const FORMATTING = /[\s().-]/g;

export function normalizeE164(input: string | null | undefined): string | null {
  if (!input) return null;

  let digits = String(input).replace(FORMATTING, "");
  if (!digits) return null;

  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("0")) {
    // Kosovo local mobile form: 04x xxx xxx -> +383 4x xxx xxx
    if (/^04\d{7}$/.test(digits)) {
      return `+383${digits.slice(1)}`;
    }
    return null;
  }

  if (/^\d{6,15}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

export function phoneDigits(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/^\+/, "");
  return digits || null;
}
