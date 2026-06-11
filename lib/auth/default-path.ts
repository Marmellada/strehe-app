import type { AppRole } from "@/lib/auth/roles";

export function getDefaultAppPath(role: AppRole) {
  return role === "household" ? "/household" : "/dashboard";
}
