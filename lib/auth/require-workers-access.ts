import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireWorkersAccess() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    appUserError ||
    !appUser ||
    !appUser.is_active ||
    !["admin", "office"].includes(appUser.role)
  ) {
    redirect("/unauthorized");
  }

  return { supabase, user, appUser };
}