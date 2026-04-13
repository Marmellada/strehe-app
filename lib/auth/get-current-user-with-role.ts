import { createClient } from "@/lib/supabase/server";
import type { AppRole, AppUser } from "@/lib/auth/roles";
import { isAppRole } from "@/lib/auth/roles";
import { createPerfTimer } from "@/lib/perf";

type CurrentUserWithRole = {
  authUser: {
    id: string;
    email: string | undefined;
  };
  appUser: AppUser;
};

type ClaimsShape = {
  sub?: string;
  email?: string;
  claims?: {
    sub?: string;
    email?: string;
  };
};

export async function getCurrentUserWithRole(): Promise<CurrentUserWithRole | null> {
  const perf = createPerfTimer("auth.getCurrentUserWithRole");
  const supabase = await createClient();
  perf.mark("createClient");

  const claimsResult = await supabase.auth.getClaims();
  const rawClaims = (claimsResult.data as ClaimsShape | null) ?? null;
  perf.mark("auth.getClaims");

  const claims = rawClaims?.claims ?? rawClaims ?? null;
  const userId = claims?.sub ?? null;
  const email = claims?.email;

  console.log("[RBAC] auth.getClaims()", {
    userId,
    email: email ?? null,
  });

  if (!userId) {
    perf.finish({
      authenticated: false,
    });
    return null;
  }

  const { data: appUserRow, error: appUserError } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .single();

  console.log("[RBAC] app_users lookup", {
    appUserError: appUserError?.message ?? null,
    appUserRow,
  });
  perf.mark("app_users.lookup");

  if (appUserError || !appUserRow) {
    perf.finish({
      authenticated: true,
      appUserFound: false,
    });
    return null;
  }

  if (!isAppRole(appUserRow.role)) {
    throw new Error(`Invalid role found for user ${userId}: ${appUserRow.role}`);
  }

  perf.finish({
    authenticated: true,
    appUserFound: true,
    role: appUserRow.role,
  });

  return {
    authUser: {
      id: userId,
      email,
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
