import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import { createClient } from "@/lib/supabase/server";

export type HouseholdSpace = {
  id: string;
  name: string;
  is_active: boolean;
};

export async function requireHouseholdAccess() {
  const current = await getCurrentUserWithRole();

  if (!current) {
    redirect("/auth/login?next=/household");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_spaces")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("created_at");

  if (error) {
    throw new Error(`Household access check failed: ${error.message}`);
  }

  const spaces = (data ?? []) as HouseholdSpace[];

  if (current.appUser.role !== "admin" && spaces.length === 0) {
    redirect("/unauthorized");
  }

  return {
    ...current,
    supabase,
    spaces,
  };
}
