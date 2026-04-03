export const APP_ROLES = ["admin", "office", "field", "contractor"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AppUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function hasRequiredRole(
  role: AppRole,
  allowedRoles: readonly AppRole[]
) {
  return allowedRoles.includes(role);
}