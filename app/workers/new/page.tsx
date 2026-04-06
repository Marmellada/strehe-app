import { PageHeader } from "@/components/ui/PageHeader";
import WorkerForm from "@/components/workers/WorkerForm";
import { createWorker } from "@/lib/actions/workers";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";

export default async function NewStaffPage() {
  await requireWorkersAccess();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New staff record"
        description="Create a new staff record."
      />

      <WorkerForm action={createWorker} submitLabel="Create staff record" />
    </div>
  );
}