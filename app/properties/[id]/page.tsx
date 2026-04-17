import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailField,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import DeletePropertyButton from "./DeletePropertyButton";
import { requireRole } from "@/lib/auth/require-role";

async function deleteProperty(id: string) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      status: "inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/properties");
}

type RelatedMunicipality =
  | { id: string; name: string }
  | { id: string; name: string }[]
  | null;

type RelatedLocation =
  | { id: string; name: string; type: string | null }
  | { id: string; name: string; type: string | null }[]
  | null;

type RelatedClient =
  | { id: string; full_name: string | null; company_name: string | null }
  | { id: string; full_name: string | null; company_name: string | null }[]
  | null;

type RelatedPlan =
  | { id: string; name: string | null }
  | { id: string; name: string | null }[]
  | null;

type PropertyRecord = {
  id: string;
  property_code: string | null;
  title: string | null;
  owner_client_id: string | null;
  municipality_id: string | null;
  location_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  country: string | null;
  property_type: string | null;
  status: string | null;
  municipalities: RelatedMunicipality;
  locations: RelatedLocation;
  clients: RelatedClient;
};

type ContractRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  monthly_price: number | string | null;
  packages: RelatedPlan;
};

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
};

type KeyRow = {
  id: string;
  status: string | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function isOpenTaskStatus(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase();
  return !["completed", "done", "cancelled"].includes(normalized);
}

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyDetailPage({
  params,
}: PropertyPageProps) {
  await requireRole(["admin", "office"]);

  const { id } = await params;
  const supabase = await createClient();

  const [
    propertyResult,
    keysResult,
    contractsResult,
    tasksResult,
    taskStatsResult,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `
          id,
          property_code,
          title,
          owner_client_id,
          municipality_id,
          location_id,
          address_line_1,
          address_line_2,
          country,
          property_type,
          status,
          municipalities ( id, name ),
          locations ( id, name, type ),
          clients ( id, full_name, company_name )
        `
      )
      .eq("id", id)
      .single(),

    supabase
      .from("keys")
      .select("id, status")
      .eq("property_id", id),

    supabase
      .from("subscriptions")
      .select(
        `
          id,
          start_date,
          end_date,
          status,
          monthly_price,
          packages (
            id,
            name
          )
        `
      )
      .eq("property_id", id)
      .order("start_date", { ascending: false }),

    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("property_id", id)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("tasks")
      .select("id, status")
      .eq("property_id", id),
  ]);

  const { data, error } = propertyResult;

  if (error || !data) {
    return notFound();
  }

  const property = data as PropertyRecord;
  const municipality = getSingleRelation(property.municipalities);
  const location = getSingleRelation(property.locations);
  const ownerClient = getSingleRelation(property.clients);

  const owner =
    ownerClient?.company_name ||
    ownerClient?.full_name ||
    "No owner assigned";

  const contracts = (contractsResult.data || []) as ContractRow[];
  const tasks = (tasksResult.data || []) as TaskRow[];
  const allTaskStats = (taskStatsResult.data || []) as Array<{
    id: string;
    status: string | null;
  }>;
  const keys = (keysResult.data || []) as KeyRow[];
  const keysCount = keys.length;

  const activeContract =
    contracts.find((contract) => (contract.status || "").toLowerCase() === "active") ||
    null;

  const activePlan = activeContract
    ? getSingleRelation(activeContract.packages)
    : null;

  const activeContractsCount = contracts.filter(
    (contract) => (contract.status || "").toLowerCase() === "active"
  ).length;
  const openTasksCount = allTaskStats.filter((task) =>
    isOpenTaskStatus(task.status)
  ).length;
  const escalatedTasksCount = allTaskStats.filter((task) => {
    const status = (task.status || "").toLowerCase();
    return status === "escalated" || status === "blocked";
  }).length;
  const availableKeysCount = keys.filter(
    (key) => (key.status || "").toLowerCase() === "available"
  ).length;
  const assignedKeysCount = keys.filter(
    (key) => (key.status || "").toLowerCase() === "assigned"
  ).length;

  const deletePropertyWithId = deleteProperty.bind(null, id);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={property.property_type || "property"} />
        <StatusBadge status={property.status} />
      </div>

      <PageHeader
        title={property.title || "Untitled Property"}
        description={property.property_code || "No property code"}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/properties">Back to Properties</Link>
            </Button>

            <Button asChild>
              <Link href={`/properties/${id}/edit`}>Edit Property</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href={`/properties/${id}/keys`}>
                Manage Keys {typeof keysCount === "number" ? `(${keysCount})` : ""}
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link href={`/subscriptions/create?property_id=${id}`}>New Contract</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href={`/tasks/create?property_id=${id}`}>New Task</Link>
            </Button>

            <form action={deletePropertyWithId}>
              <DeletePropertyButton />
            </form>
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card size="sm"><CardContent><DetailField label="Owner" value={owner} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Municipality" value={municipality?.name || "-"} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Location" value={location?.name || "-"} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Tracked Keys" value={keysCount} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Open Work Orders" value={openTasksCount} /></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Open Work</CardTitle>
              <CardDescription>Current task pressure for this property.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/tasks?property=${id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Open Tasks" value={openTasksCount} />
            <DetailField label="Escalated Tasks" value={escalatedTasksCount} />
            <DetailField label="Next Step" value={openTasksCount > 0 ? "Review active work" : "Create the next task"} />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/tasks/create?property_id=${id}`}>New Task</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/tasks?property=${id}&status=open`}>Open Tasks</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Contracts</CardTitle>
              <CardDescription>Service agreements tied to this property.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/subscriptions">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Total Contracts" value={contracts.length} />
            <DetailField label="Active Contracts" value={activeContractsCount} />
            <DetailField
              label="Current Plan"
              value={activePlan?.name || (activeContract ? "Active contract" : "No active contract")}
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/subscriptions/create?property_id=${id}`}>New Contract</Link>
              </Button>
              {activeContract ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/subscriptions/${activeContract.id}`}>Open Active Contract</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Keys</CardTitle>
              <CardDescription>Access assets and handover readiness.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/properties/${id}/keys`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Tracked Keys" value={keysCount} />
            <DetailField label="Available Keys" value={availableKeysCount} />
            <DetailField label="Assigned Keys" value={assignedKeysCount} />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/properties/${id}/keys`}>Manage Keys</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/properties/${id}/keys/new`}>Add Key</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Property Information</CardTitle>
            <CardDescription>Core registration and address details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <DetailField label="Property Code" value={property.property_code || "-"} />
            <DetailField label="Title" value={property.title || "-"} />
            <DetailField label="Property Type" value={property.property_type || "-"} />
            <DetailField label="Status" value={formatLabel(property.status)} />
            <DetailField label="Address Line 1" value={property.address_line_1 || "-"} />
            <DetailField label="Address Line 2" value={property.address_line_2 || "-"} />
            <DetailField label="Country" value={property.country || "-"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Summary</CardTitle>
            <CardDescription>Day-to-day context for this property.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Assigned Owner" value={owner} />
            <DetailField label="Municipality" value={municipality?.name || "-"} />
            <DetailField label="Location Type" value={location?.type || "-"} />
            <DetailField
              label="Active Contract"
              value={activePlan?.name || (activeContract ? "Active" : "None")}
            />
            <DetailField
              label="Monthly Value"
              value={activeContract ? `${formatPrice(activeContract.monthly_price)} / mo` : "-"}
            />
            {ownerClient?.id ? (
              <div>
                <Button asChild variant="ghost">
                  <Link href={`/clients/${ownerClient.id}`}>View Owner</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Contracts</CardTitle>
              <CardDescription>Service agreements linked to this property.</CardDescription>
            </div>
            <Button asChild>
              <Link href={`/subscriptions/create?property_id=${id}`}>Add Contract</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {contracts.length === 0 ? (
              <EmptyState
                title="No contracts assigned yet"
                description="Create the first service agreement for this property."
              />
            ) : (
              contracts.map((contract) => {
                const plan = getSingleRelation(contract.packages);
                return (
                  <div key={contract.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <div className="font-medium text-foreground">{plan?.name || "Unnamed Plan"}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(contract.monthly_price)} / mo • {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={contract.status} />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/subscriptions/${contract.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Recent Work Orders</CardTitle>
              <CardDescription>Latest operational activity for this property.</CardDescription>
            </div>
            <Button asChild>
              <Link href={`/tasks/create?property_id=${id}`}>Add Task</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {tasks.length === 0 ? (
              <EmptyState
                title="No tasks created yet"
                description="Create the first task for this property."
              />
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div>
                    <div className="font-medium text-foreground">{task.title || "Untitled Task"}</div>
                    <div className="text-sm text-muted-foreground">
                      Due: {formatDate(task.due_date)} • Priority: {formatLabel(task.priority)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={task.status} />
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/tasks/${task.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Key Access</CardTitle>
            <CardDescription>Secure access assets linked to this property.</CardDescription>
          </div>
          <Button asChild>
            <Link href={`/properties/${id}/keys`}>Manage Keys</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <DetailField label="Tracked Keys" value={keysCount} />
          <DetailField
            label="Access Risk"
            value={keysCount > 0 ? "Tracked" : "No keys registered"}
          />
          <DetailField
            label="Action"
            value={keysCount > 0 ? "Review handovers regularly" : "Add first key"}
          />
        </CardContent>
      </Card>
    </main>
  );
}
