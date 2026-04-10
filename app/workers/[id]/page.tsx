import { notFound } from "next/navigation";
import {
  DetailField,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/ui";
import WorkerForm from "@/components/workers/WorkerForm";
import { updateWorker } from "@/lib/actions/workers";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";
import { formatStatusLabel } from "@/lib/ui/status";
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

type Params = Promise<{ id: string }>;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default async function StaffDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const { supabase } = await requireWorkersAccess();
  const rawClient = supabase as unknown as RawBankIdentifierQueryClient;

  const [{ data: worker, error }, { data: banks }, { data: identifiersData }] =
    await Promise.all([
      supabase.from("workers").select("*").eq("id", id).maybeSingle(),
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

  if (error) {
    throw new Error(error.message);
  }

  if (!worker) {
    notFound();
  }

  const updateAction = updateWorker.bind(null, id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={worker.full_name}
        description="Staff detail and edit view."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <SectionCard title="Summary" contentClassName="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={worker.status} />
          </div>

          <div className="grid gap-4 text-sm">
            <DetailField
              label="Staff type"
              value={formatStatusLabel(worker.worker_type)}
            />
            <DetailField label="Role" value={worker.role_title || "—"} />
            <DetailField label="Email" value={worker.email || "—"} />
            <DetailField label="Phone" value={worker.phone || "—"} />
            <DetailField label="Start date" value={worker.start_date || "—"} />
            <DetailField label="End date" value={worker.end_date || "—"} />
            <DetailField
              label="Created at"
              value={formatDateTime(worker.created_at)}
            />
            <DetailField
              label="Updated at"
              value={formatDateTime(worker.updated_at)}
            />
          </div>
        </SectionCard>

        <div className="md:col-span-2">
          <WorkerForm
            action={updateAction}
            submitLabel="Save changes"
            cancelHref="/workers"
            worker={{
              ...worker,
              start_date: worker.start_date ?? "",
              end_date: worker.end_date ?? "",
            }}
            banks={banks || []}
            identifiers={(identifiersData || []) as BankIdentifierRule[]}
          />
        </div>
      </div>
    </div>
  );
}
