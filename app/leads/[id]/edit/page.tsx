import { notFound } from "next/navigation";
import { updateLeadAction } from "@/lib/actions/leads";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import LeadForm from "../../LeadForm";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { id } = await params;

  const [{ data: lead }, { data: users }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("app_users")
      .select("id, full_name, email")
      .eq("is_active", true)
      .in("role", ["admin", "office"])
      .order("full_name"),
  ]);

  if (!lead) return notFound();

  const action = updateLeadAction.bind(null, id);

  return (
    <LeadForm
      action={action}
      users={users || []}
      initialData={lead}
      isEdit
      leadId={id}
    />
  );
}
