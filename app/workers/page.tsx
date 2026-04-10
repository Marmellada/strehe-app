import Link from "next/link";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";
import { formatStatusLabel } from "@/lib/ui/status";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

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
  const activeWorkers = (workers || []).filter((worker) => worker.status === "active").length;
  const contractors = (workers || []).filter(
    (worker) => worker.worker_type === "contractor"
  ).length;

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {(workers || []).length}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {activeWorkers}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Contractors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {contractors}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-4 md:grid-cols-2">
            <FormField id="status" label="Status">
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
            </FormField>

            <FormField id="worker_type" label="Staff type">
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
            </FormField>

            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit">Apply Filters</Button>

              <Link href="/workers">
                <Button variant="outline">Reset</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

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
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Start</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {workers.map((worker) => (
                <TableRow
                  key={worker.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/workers/${worker.id}`}
                      className="hover:underline"
                    >
                      {worker.full_name}
                    </Link>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {worker.role_title}
                  </TableCell>

                  <TableCell>
                    <StatusBadge
                      status={worker.worker_type}
                      fallbackLabel={formatStatusLabel(worker.worker_type)}
                    />
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={worker.status} />
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {worker.email || "—"}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {worker.phone || "—"}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {worker.start_date || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </div>
  );
}
