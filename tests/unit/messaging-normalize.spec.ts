import { expect, test } from "@playwright/test";
import { normalizeE164, phoneDigits } from "@/lib/messaging/normalize";
import { decideWhatsAppResolution } from "@/lib/messaging/resolution";

test.describe("phone normalization", () => {
  test("normalizes Kosovo and international WhatsApp forms to E.164", () => {
    expect(normalizeE164("+383 44 800 047")).toBe("+38344800047");
    expect(normalizeE164("383 44 800 047")).toBe("+38344800047");
    expect(normalizeE164("044 800 047")).toBe("+38344800047");
    expect(normalizeE164("044-800-047")).toBe("+38344800047");
    expect(normalizeE164("(044) 800 047")).toBe("+38344800047");
    expect(normalizeE164("+38344800047")).toBe("+38344800047");
  });

  test("returns null for empty, unknown local, or invalid input", () => {
    expect(normalizeE164("")).toBeNull();
    expect(normalizeE164(null)).toBeNull();
    expect(normalizeE164(undefined)).toBeNull();
    expect(normalizeE164("abc")).toBeNull();
    expect(normalizeE164("123")).toBeNull();
    expect(normalizeE164("0512345678")).toBeNull(); // non-04x local prefix unsupported in V1
  });

  test("strips the leading plus for raw-digit comparison", () => {
    expect(phoneDigits("+38344800047")).toBe("38344800047");
    expect(phoneDigits(null)).toBeNull();
  });
});

test.describe("WhatsApp identity resolution decision", () => {
  test("resolves to a single unambiguous lead", () => {
    expect(decideWhatsAppResolution({ leadIds: ["l1"], clientIds: [] })).toEqual({
      outcome: "resolved",
      target: "lead",
      id: "l1",
    });
  });

  test("resolves to a single unambiguous client", () => {
    expect(decideWhatsAppResolution({ leadIds: [], clientIds: ["c1"] })).toEqual({
      outcome: "resolved",
      target: "client",
      id: "c1",
    });
  });

  test("marks multiple leads as needs_review", () => {
    expect(decideWhatsAppResolution({ leadIds: ["l1", "l2"], clientIds: [] })).toEqual({
      outcome: "needs_review",
    });
  });

  test("marks a lead plus a client as needs_review", () => {
    expect(decideWhatsAppResolution({ leadIds: ["l1"], clientIds: ["c1"] })).toEqual({
      outcome: "needs_review",
    });
  });

  test("remains unresolved when nothing matches", () => {
    expect(decideWhatsAppResolution({ leadIds: [], clientIds: [] })).toEqual({
      outcome: "unresolved",
    });
  });

  test("deduplicates repeated ids", () => {
    expect(decideWhatsAppResolution({ leadIds: ["l1", "l1"], clientIds: [] })).toEqual({
      outcome: "resolved",
      target: "lead",
      id: "l1",
    });
  });
});
