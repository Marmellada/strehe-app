import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import type { AppRole } from "@/lib/auth/roles";
import { hasRequiredRole } from "@/lib/auth/roles";

export async function requireRole(allowedRoles: readonly AppRole[]) {
  const current = await getCurrentUserWithRole();

  console.log("[RBAC] requireRole()", {
    allowedRoles,
    current,
  });

  if (!current) {
    redirect("/auth/login");
  }

  if (!current.appUser.is_active) {
    redirect("/unauthorized");
  }

  if (!hasRequiredRole(current.appUser.role, allowedRoles)) {
    console.log("[RBAC] blocked by role", {
      currentRole: current.appUser.role,
      allowedRoles,
    });
    redirect("/unauthorized");
  }

  return current;
}