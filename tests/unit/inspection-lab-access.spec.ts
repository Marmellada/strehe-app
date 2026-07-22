import { expect, test } from "@playwright/test";
import {
  createInspectionLabAdminAccess,
  InspectionLabAccessDeniedError,
  type InspectionLabIdentity,
} from "@/lib/security/inspection-lab-access";

function createHarness(identity: InspectionLabIdentity | null) {
  let adminClientInitializations = 0;
  const adminClient = { marker: "service-role-client" };

  const requireAdmin = createInspectionLabAdminAccess({
    getIdentity: async () => identity,
    getAdminClient: () => {
      adminClientInitializations += 1;
      return adminClient;
    },
  });

  return {
    requireAdmin,
    adminClient,
    get adminClientInitializations() {
      return adminClientInitializations;
    },
  };
}

test.describe("Inspection Lab production authorization", () => {
  test("accepts an active admin and initializes the admin client once", async () => {
    const harness = createHarness({
      id: "admin-user",
      role: "admin",
      isActive: true,
    });

    const context = await harness.requireAdmin();

    expect(context.appUser.role).toBe("admin");
    expect(context.supabase).toBe(harness.adminClient);
    expect(harness.adminClientInitializations).toBe(1);
  });

  for (const role of [
    "office",
    "field",
    "contractor",
    "household",
    "agent",
  ]) {
    test("denies active " + role + " without initializing the admin client", async () => {
      const harness = createHarness({
        id: role + "-user",
        role,
        isActive: true,
      });

      await expect(harness.requireAdmin()).rejects.toBeInstanceOf(
        InspectionLabAccessDeniedError
      );
      expect(harness.adminClientInitializations).toBe(0);
    });
  }

  test("denies an inactive admin without initializing the admin client", async () => {
    const harness = createHarness({
      id: "inactive-admin",
      role: "admin",
      isActive: false,
    });

    await expect(harness.requireAdmin()).rejects.toBeInstanceOf(
      InspectionLabAccessDeniedError
    );
    expect(harness.adminClientInitializations).toBe(0);
  });

  test("denies an unauthenticated identity without initializing the admin client", async () => {
    const harness = createHarness(null);

    await expect(harness.requireAdmin()).rejects.toBeInstanceOf(
      InspectionLabAccessDeniedError
    );
    expect(harness.adminClientInitializations).toBe(0);
  });
});
