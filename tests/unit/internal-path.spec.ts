import { expect, test } from "@playwright/test";
import { getSafeInternalPath } from "@/lib/security/internal-path";

test.describe("internal redirect path validation", () => {
  for (const path of [
    "/",
    "/dashboard",
    "/tasks/123",
    "/settings/users?tab=active#invite",
    "/search?q=hello%20world",
  ]) {
    test("accepts internal path: " + path, () => {
      expect(getSafeInternalPath(path)).toBe(path);
    });
  }

  const rejected = [
    { name: "protocol-relative URL", value: "//attacker.example" },
    { name: "encoded double slash", value: "/%2F%2Fattacker.example" },
    { name: "double-encoded slash", value: "/%252f%252fattacker.example" },
    { name: "deeply encoded slash", value: "/%25252525252f%25252525252fattacker.example" },
    { name: "raw backslash", value: "/\\attacker.example" },
    { name: "encoded backslash", value: "/%5c%5cattacker.example" },
    { name: "HTTP URL", value: "http://attacker.example" },
    { name: "HTTPS URL", value: "https://attacker.example" },
    { name: "raw control character", value: "/dashboard\nadmin" },
    { name: "encoded control character", value: "/dashboard%0d%0aadmin" },
    { name: "malformed percent encoding", value: "/%E0%A4%A" },
  ];

  for (const rejectedCase of rejected) {
    test("rejects " + rejectedCase.name, () => {
      expect(getSafeInternalPath(rejectedCase.value)).toBe("/dashboard");
    });
  }

  test("uses the fixed safe fallback for missing values", () => {
    expect(getSafeInternalPath(null)).toBe("/dashboard");
    expect(getSafeInternalPath(undefined)).toBe("/dashboard");
    expect(getSafeInternalPath("")).toBe("/dashboard");
  });
});
