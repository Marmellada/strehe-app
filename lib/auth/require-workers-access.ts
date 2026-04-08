import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export async function requireWorkersAccess() {
  const current = await requireRole(["admin", "office"]);
  const supabase = await createClient();

  return {
    supabase,
    user: current.authUser,
    appUser: current.appUser,
  };
}
