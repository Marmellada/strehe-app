import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { createLeadAction } from "@/lib/actions/leads";
import LeadForm from "../LeadForm";

export default async function NewLeadPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("app_users")
    .select("id, full_name, email")
    .eq("is_active", true)
    .in("role", ["admin", "office"])
    .order("full_name");

  return <LeadForm action={createLeadAction} users={users || []} />;
}
