import { PageHeader } from "@/components/ui/PageHeader";
import WorkerForm from "@/components/workers/WorkerForm";
import { createWorker } from "@/lib/actions/workers";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";
import type { BankIdentifierRule } from "@/types/banking";

type RawBankIdentifierQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: boolean
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

export default async function NewStaffPage() {
  const { supabase } = await requireWorkersAccess();
  const rawClient = supabase as unknown as RawBankIdentifierQueryClient;

  const [{ data: banks }, { data: identifiersData }] = await Promise.all([
    supabase
      .from("banks")
      .select("id, name, short_name, swift_code, country, country_code, is_active")
      .eq("is_active", true)
      .order("name"),
    rawClient
      .from("bank_identifiers")
      .select(
        "id, bank_id, identifier_type, value, value_end, scheme, country_code, priority, is_active, source, notes"
      )
      .eq("is_active", true),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New staff record"
        description="Create a new staff record."
      />

      <WorkerForm
        action={createWorker}
        submitLabel="Create staff record"
        banks={banks || []}
        identifiers={(identifiersData || []) as BankIdentifierRule[]}
      />
    </div>
  );
}
