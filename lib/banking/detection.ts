import type {
  BankDetectionMatch,
  BankDetectionResult,
  BankIdentifierRule,
  BankInputKind,
  BankRegistryBank,
  CardScheme,
} from "@/types/banking";

function toUpperTrimmed(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeIban(value: string) {
  return toUpperTrimmed(value).replace(/\s+/g, "");
}

export function normalizeCardNumber(value: string) {
  return value.replace(/\D+/g, "");
}

export function normalizeAccountNumber(value: string) {
  return toUpperTrimmed(value).replace(/\s+/g, "");
}

export function luhnCheck(value: string) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value.charAt(index));

    if (Number.isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function detectCardScheme(cardNumber: string): CardScheme {
  if (/^4\d{12}(\d{3}){0,2}$/.test(cardNumber)) return "visa";

  const prefix2 = Number(cardNumber.slice(0, 2));
  const prefix3 = Number(cardNumber.slice(0, 3));
  const prefix6 = Number(cardNumber.slice(0, 6));

  if (
    /^(5[1-5]\d{14})$/.test(cardNumber) ||
    (prefix6 >= 222100 && prefix6 <= 272099 && cardNumber.length === 16)
  ) {
    return "mastercard";
  }

  if (/^3[47]\d{13}$/.test(cardNumber)) return "amex";

  if (
    /^6(?:011|5\d{2})\d{12}$/.test(cardNumber) ||
    (prefix6 >= 622126 && prefix6 <= 622925) ||
    (prefix3 >= 644 && prefix3 <= 649) ||
    prefix2 === 65
  ) {
    return "discover";
  }

  if (
    (prefix3 >= 300 && prefix3 <= 305) ||
    prefix2 === 36 ||
    prefix2 === 38 ||
    prefix2 === 39
  ) {
    return "diners";
  }

  return "unknown";
}

export function classifyBankInput(rawInput: string): BankInputKind {
  const trimmed = rawInput.trim();
  if (!trimmed) return "unknown";

  const iban = normalizeIban(trimmed);
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) {
    return "iban";
  }

  const digits = normalizeCardNumber(trimmed);
  if (digits.length >= 12 && digits.length <= 19 && luhnCheck(digits)) {
    return "card_number";
  }

  const account = normalizeAccountNumber(trimmed);
  if (/^[A-Z0-9-]{6,34}$/.test(account)) {
    return "account_number";
  }

  return "unknown";
}

function validateIban(iban: string) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) {
    return {
      isValid: false,
      validationMessage: "IBAN format is invalid.",
      countryCode: null,
    };
  }

  const countryCode = iban.slice(0, 2);

  if (countryCode === "XK" && !/^XK\d{18}$/.test(iban)) {
    return {
      isValid: false,
      validationMessage: "Kosovo IBAN must be in format XK followed by 18 digits.",
      countryCode,
    };
  }

  return {
    isValid: true,
    validationMessage: "IBAN format looks valid.",
    countryCode,
  };
}

function validateCardNumber(cardNumber: string) {
  if (cardNumber.length < 12 || cardNumber.length > 19) {
    return {
      isValid: false,
      validationMessage: "Card number must be between 12 and 19 digits.",
      cardScheme: detectCardScheme(cardNumber),
    };
  }

  if (!luhnCheck(cardNumber)) {
    return {
      isValid: false,
      validationMessage: "Card number failed checksum validation.",
      cardScheme: detectCardScheme(cardNumber),
    };
  }

  return {
    isValid: true,
    validationMessage: "Card number format looks valid.",
    cardScheme: detectCardScheme(cardNumber),
  };
}

function validateAccountNumber(accountNumber: string) {
  if (!/^[A-Z0-9-]{6,34}$/.test(accountNumber)) {
    return {
      isValid: false,
      validationMessage: "Account number format is invalid.",
    };
  }

  return {
    isValid: true,
    validationMessage: "Account number format looks valid.",
  };
}

function compareRange(input: string, start: string, end?: string | null) {
  if (!end) return input.startsWith(start);

  const probe = input.slice(0, start.length);
  if (!/^\d+$/.test(start) || !/^\d+$/.test(end) || !/^\d+$/.test(probe)) {
    return input.startsWith(start);
  }

  const value = Number(probe);
  return value >= Number(start) && value <= Number(end);
}

function matchRuleSet(
  input: string,
  kind: BankInputKind,
  identifiers: BankIdentifierRule[],
  banks: BankRegistryBank[]
): BankDetectionMatch | null {
  const ruleType =
    kind === "iban"
      ? "iban_prefix"
      : kind === "card_number"
      ? "card_bin"
      : kind === "account_number"
      ? "account_prefix"
      : null;

  if (!ruleType) return null;

  const activeRules = identifiers
    .filter(
      (rule) =>
        rule.identifier_type === ruleType && (rule.is_active ?? true) && rule.value
    )
    .sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100));

  for (const rule of activeRules) {
    if (!compareRange(input, rule.value, rule.value_end)) continue;

    const bank = banks.find((candidate) => candidate.id === rule.bank_id);
    if (!bank) continue;

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankShortName: bank.short_name ?? null,
      swiftCode: bank.swift_code ?? null,
      matchedBy: rule.identifier_type,
      matchedValue: rule.value_end ? `${rule.value}-${rule.value_end}` : rule.value,
      scheme: rule.scheme ?? null,
    };
  }

  return null;
}

export function detectBankFromInput(params: {
  input: string;
  identifiers?: BankIdentifierRule[];
  banks?: BankRegistryBank[];
}): BankDetectionResult {
  const { input, identifiers = [], banks = [] } = params;
  const kind = classifyBankInput(input);

  if (kind === "unknown") {
    return {
      rawInput: input,
      normalizedInput: input.trim(),
      kind,
      isValid: false,
      validationMessage:
        "Unable to classify input as IBAN, card number, or account number.",
      availableRuleCount: identifiers.filter((rule) => rule.is_active ?? true).length,
    };
  }

  if (kind === "iban") {
    const normalizedInput = normalizeIban(input);
    const validation = validateIban(normalizedInput);
    const matchedBank = validation.isValid
      ? matchRuleSet(normalizedInput, kind, identifiers, banks)
      : null;

    return {
      rawInput: input,
      normalizedInput,
      kind,
      isValid: validation.isValid,
      validationMessage: validation.validationMessage,
      countryCode: validation.countryCode,
      matchedBank,
      availableRuleCount: identifiers.filter(
        (rule) => rule.identifier_type === "iban_prefix" && (rule.is_active ?? true)
      ).length,
    };
  }

  if (kind === "card_number") {
    const normalizedInput = normalizeCardNumber(input);
    const validation = validateCardNumber(normalizedInput);
    const matchedBank = validation.isValid
      ? matchRuleSet(normalizedInput, kind, identifiers, banks)
      : null;

    return {
      rawInput: input,
      normalizedInput,
      kind,
      isValid: validation.isValid,
      validationMessage: validation.validationMessage,
      cardScheme: validation.cardScheme,
      matchedBank,
      availableRuleCount: identifiers.filter(
        (rule) => rule.identifier_type === "card_bin" && (rule.is_active ?? true)
      ).length,
    };
  }

  const normalizedInput = normalizeAccountNumber(input);
  const validation = validateAccountNumber(normalizedInput);
  const matchedBank = validation.isValid
    ? matchRuleSet(normalizedInput, kind, identifiers, banks)
    : null;

  return {
    rawInput: input,
    normalizedInput,
    kind,
    isValid: validation.isValid,
    validationMessage: validation.validationMessage,
    matchedBank,
    availableRuleCount: identifiers.filter(
      (rule) => rule.identifier_type === "account_prefix" && (rule.is_active ?? true)
    ).length,
  };
}
