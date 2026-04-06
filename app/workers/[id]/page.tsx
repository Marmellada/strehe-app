import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import WorkerForm from "@/components/workers/WorkerForm";
import { updateWorker } from "@/lib/actions/workers";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";

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

  const { data: worker, error } = await supabase
    .from("workers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

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
        <div className="space-y-4 rounded-2xl border bg-card p-5 md:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Summary</h2>
            <Badge variant={getStatusVariant(worker.status)}>
              {formatStatusLabel(worker.status)}
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-foreground">Staff type:</span>{" "}
              <span className="text-muted-foreground">
                {formatStatusLabel(worker.worker_type)}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">Role:</span>{" "}
              <span className="text-muted-foreground">
                {worker.role_title || "—"}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">Email:</span>{" "}
              <span className="text-muted-foreground">
                {worker.email || "—"}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">Phone:</span>{" "}
              <span className="text-muted-foreground">
                {worker.phone || "—"}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">Start date:</span>{" "}
              <span className="text-muted-foreground">
                {worker.start_date || "—"}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">End date:</span>{" "}
              <span className="text-muted-foreground">
                {worker.end_date || "—"}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">Created at:</span>{" "}
              <span className="text-muted-foreground">
                {formatDateTime(worker.created_at)}
              </span>
            </div>

            <div>
              <span className="font-medium text-foreground">Updated at:</span>{" "}
              <span className="text-muted-foreground">
                {formatDateTime(worker.updated_at)}
              </span>
            </div>
          </div>
        </div>

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
          />
        </div>
      </div>
    </div>
  );
}