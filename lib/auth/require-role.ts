import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import type { AppRole } from "@/lib/auth/roles";
import { hasRequiredRole } from "@/lib/auth/roles";
import { createPerfTimer } from "@/lib/perf";

export async function requireRole(allowedRoles: readonly AppRole[]) {
  const perf = createPerfTimer("auth.requireRole");
  const current = await getCurrentUserWithRole();
  perf.mark("getCurrentUserWithRole");

  console.log("[RBAC] requireRole()", {
    allowedRoles,
    current,
  });

  if (!current) {
    perf.finish({
      allowedRoles: allowedRoles.join(","),
      outcome: "redirect_login",
    });
    redirect("/auth/login");
  }

  if (!current.appUser.is_active) {
    perf.finish({
      allowedRoles: allowedRoles.join(","),
      outcome: "redirect_unauthorized_inactive",
      role: current.appUser.role,
    });
    redirect("/unauthorized");
  }

  if (!hasRequiredRole(current.appUser.role, allowedRoles)) {
    console.log("[RBAC] blocked by role", {
      currentRole: current.appUser.role,
      allowedRoles,
    });
    perf.finish({
      allowedRoles: allowedRoles.join(","),
      outcome: "redirect_unauthorized_role",
      role: current.appUser.role,
    });
    redirect("/unauthorized");
  }

  perf.finish({
    allowedRoles: allowedRoles.join(","),
    outcome: "allowed",
    role: current.appUser.role,
  });

  return current;
}
