import { createClient } from "@/lib/supabase/server";
import type { AppRole, AppUser } from "@/lib/auth/roles";
import { isAppRole } from "@/lib/auth/roles";

type CurrentUserWithRole = {
  authUser: {
    id: string;
    email: string | undefined;
  };
  appUser: AppUser;
};

export async function getCurrentUserWithRole(): Promise<CurrentUserWithRole | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log("[RBAC] auth.getUser()", {
    authError: authError?.message ?? null,
    userId: user?.id ?? null,
    email: user?.email ?? null,
  });

  if (authError || !user) {
    return null;
  }

  const { data: appUserRow, error: appUserError } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  console.log("[RBAC] app_users lookup", {
    appUserError: appUserError?.message ?? null,
    appUserRow,
  });

  if (appUserError || !appUserRow) {
    return null;
  }

  if (!isAppRole(appUserRow.role)) {
    throw new Error(`Invalid role found for user ${user.id}: ${appUserRow.role}`);
  }

  return {
    authUser: {
      id: user.id,
      email: user.email,
    },
    appUser: {
      id: appUserRow.id,
      email: appUserRow.email,
      full_name: appUserRow.full_name,
      role: appUserRow.role as AppRole,
      is_active: appUserRow.is_active,
    },
  };
}