import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { createLeadAction } from "@/lib/actions/leads";
import LeadForm from "../LeadForm";

type NewLeadPageProps = {
  searchParams?: Promise<{
    source?: string;
  }>;
};

export default async function NewLeadPage({ searchParams }: NewLeadPageProps) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const params = (await searchParams) || {};
  const source = String(params.source || "").trim();
  const initialData =
    source === "whatsapp"
      ? {
          source: "whatsapp",
          preferred_contact_method: "whatsapp",
          notes: "Created from WhatsApp conversation.",
        }
      : undefined;

  const { data: users } = await supabase
    .from("app_users")
    .select("id, full_name, email")
    .eq("is_active", true)
    .in("role", ["admin", "office"])
    .order("full_name");

  return (
    <LeadForm action={createLeadAction} users={users || []} initialData={initialData} />
  );
}
