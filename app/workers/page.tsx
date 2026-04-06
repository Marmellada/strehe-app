import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";
import { Label } from "@/components/ui/Label";

type SearchParams = Promise<{
  status?: string;
  worker_type?: string;
}>;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireWorkersAccess();
  const filters = await searchParams;

  const status =
    filters.status === "active" || filters.status === "inactive"
      ? filters.status
      : "";

  const workerType =
    filters.worker_type === "employee" ||
    filters.worker_type === "contractor" ||
    filters.worker_type === "temporary"
      ? filters.worker_type
      : "";

  let query = supabase
    .from("workers")
    .select(
      "id, full_name, email, phone, role_title, worker_type, status, start_date"
    )
    .order("full_name", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  if (workerType) {
    query = query.eq("worker_type", workerType);
  }

  const { data: workers, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const hasData = workers && workers.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Operational staff registry for employees, contractors, and temporary workers."
        actions={
          <Link href="/workers/new">
            <Button>New Staff</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="rounded-2xl border bg-card p-5">
        <form method="get" className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="status">
              Status
            </Label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="input"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="worker_type"
              className="text-sm font-medium text-foreground"
            >
              Staff type
            </label>
            <select
              id="worker_type"
              name="worker_type"
              defaultValue={workerType}
              className="input"
            >
              <option value="">All</option>
              <option value="employee">Employee</option>
              <option value="contractor">Contractor</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit">
              Apply Filters
            </Button>

            <Link href="/workers">
  <Button variant="outline">Reset</Button>
</Link>
            
          </div>
        </form>
      </div>

      {/* Table / Empty */}
      {!hasData ? (
        <EmptyState
          title="No staff records yet"
          description="Create your first staff record to start managing personnel."
          action={
            <Link href="/workers/new">
              <Button>New Staff</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="border-b">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Phone
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Start
                </th>
              </tr>
            </thead>

            <tbody>
              {workers.map((worker) => (
                <tr
                  key={worker.id}
                  className="border-b last:border-none hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/workers/${worker.id}`}
                      className="hover:underline"
                    >
                      {worker.full_name}
                    </Link>
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {worker.role_title}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant="neutral">
                      {formatStatusLabel(worker.worker_type)}
                    </Badge>
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(worker.status)}>
                      {formatStatusLabel(worker.status)}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {worker.email || "—"}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {worker.phone || "—"}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {worker.start_date || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}