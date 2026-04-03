import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeletePropertyButton from "./DeletePropertyButton";

async function deleteProperty(id: string) {
  "use server";

  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);

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

function getPropertyStatusBadge(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "badge-success";
    case "vacant":
      return "badge-warning";
    case "inactive":
      return "badge-outline";
    default:
      return "badge-outline";
  }
}

function getContractStatusBadge(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "badge-success";
    case "paused":
      return "badge-warning";
    case "cancelled":
      return "badge-danger";
    default:
      return "badge-outline";
  }
}

function getTaskStatusBadge(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "open":
    case "pending":
    case "todo":
      return "badge-warning";
    case "in_progress":
    case "in progress":
      return "badge-outline";
    case "completed":
    case "done":
      return "badge-success";
    case "cancelled":
      return "badge-danger";
    default:
      return "badge-outline";
  }
}

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyDetailPage({
  params,
}: PropertyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    propertyResult,
    keysCountResult,
    contractsResult,
    tasksResult,
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
      .select("*", { count: "exact", head: true })
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
  const keysCount = keysCountResult.count || 0;

  const activeContract =
    contracts.find((contract) => (contract.status || "").toLowerCase() === "active") ||
    null;

  const activePlan = activeContract
    ? getSingleRelation(activeContract.packages)
    : null;

  const openTasksCount = tasks.filter((task) => {
    const status = (task.status || "").toLowerCase();
    return !["completed", "done", "cancelled"].includes(status);
  }).length;

  const deletePropertyWithId = deleteProperty.bind(null, id);

  return (
    <main className="space-y-6">
      <div className="status-row">
        <span className="badge badge-outline">
          {property.property_type || "Property"}
        </span>
        <span className={`badge ${getPropertyStatusBadge(property.status)}`}>
          {formatLabel(property.status)}
        </span>
      </div>

      <div>
        <h1 className="page-title">{property.title || "Untitled Property"}</h1>
        <p className="page-subtitle mt-2">
          {property.property_code || "No property code"}
        </p>
      </div>

      <div className="top-actions">
        <Link href="/properties" className="btn btn-ghost">
          ← Back to Properties
        </Link>

        <Link href={`/properties/${id}/edit`} className="btn btn-primary">
          Edit Property
        </Link>

        <Link href={`/properties/${id}/keys`} className="btn btn-ghost">
          Manage Keys {typeof keysCount === "number" ? `(${keysCount})` : ""}
        </Link>

        <Link href={`/subscriptions/create?property_id=${id}`} className="btn btn-ghost">
          + New Contract
        </Link>

        <Link href={`/tasks/create?property_id=${id}`} className="btn btn-ghost">
          + New Task
        </Link>

        <form action={deletePropertyWithId}>
          <DeletePropertyButton />
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="card">
          <span className="field-label">Owner</span>
          <span className="field-value">{owner}</span>
        </div>

        <div className="card">
          <span className="field-label">Municipality</span>
          <span className="field-value">{municipality?.name || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Location</span>
          <span className="field-value">{location?.name || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Tracked Keys</span>
          <span className="field-value">{keysCount}</span>
        </div>

        <div className="card">
          <span className="field-label">Open Work Orders</span>
          <span className="field-value">{openTasksCount}</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <h2 className="section-title">Property Information</h2>

          <div className="info-stack">
            <div className="info-row">
              <span className="field-label">Property Code</span>
              <span className="field-value">{property.property_code || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Title</span>
              <span className="field-value">{property.title || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Property Type</span>
              <span className="field-value">{property.property_type || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Status</span>
              <span className="field-value">{formatLabel(property.status)}</span>
            </div>

            <div className="info-row pt-2">
              <span className="section-title !mb-0 !text-base">Address</span>
            </div>

            <div className="info-row">
              <span className="field-label">Address Line 1</span>
              <span className="field-value">{property.address_line_1 || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Address Line 2</span>
              <span className="field-value">{property.address_line_2 || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Country</span>
              <span className="field-value">{property.country || "-"}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Operational Summary</h2>

          <div className="summary-stack">
            <div className="summary-item">
              <span className="field-label">Assigned Owner</span>
              <span className="field-value">{owner}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Municipality</span>
              <span className="field-value">{municipality?.name || "-"}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Location Type</span>
              <span className="field-value">{location?.type || "-"}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Active Contract</span>
              <span className="field-value">
                {activePlan?.name || (activeContract ? "Active" : "None")}
              </span>
            </div>

            <div className="summary-item">
              <span className="field-label">Monthly Value</span>
              <span className="field-value">
                {activeContract ? `${formatPrice(activeContract.monthly_price)} / mo` : "-"}
              </span>
            </div>

            {ownerClient?.id ? (
              <div className="summary-item pt-2">
                <Link href={`/clients/${ownerClient.id}`} className="btn btn-ghost">
                  View Owner
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title !mb-0">Contracts</h2>
              <p className="page-subtitle mt-1">
                Service agreements linked to this property.
              </p>
            </div>

            <Link href={`/subscriptions/create?property_id=${id}`} className="btn btn-primary">
              + Add Contract
            </Link>
          </div>

          {contracts.length === 0 ? (
            <p className="field-value-muted">No contracts assigned yet.</p>
          ) : (
            <div className="related-list">
              {contracts.map((contract) => {
                const plan = getSingleRelation(contract.packages);

                return (
                  <div key={contract.id} className="related-item">
                    <div>
                      <div className="related-item-title">
                        {plan?.name || "Unnamed Plan"}
                      </div>
                      <div className="related-item-subtitle">
                        {formatPrice(contract.monthly_price)} / mo •{" "}
                        {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`badge ${getContractStatusBadge(contract.status)}`}
                      >
                        {formatLabel(contract.status)}
                      </span>

                      <Link
                        href={`/subscriptions/${contract.id}`}
                        className="btn btn-ghost"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title !mb-0">Recent Work Orders</h2>
              <p className="page-subtitle mt-1">
                Latest operational activity for this property.
              </p>
            </div>

            <Link href={`/tasks/create?property_id=${id}`} className="btn btn-primary">
              + Add Task
            </Link>
          </div>

          {tasks.length === 0 ? (
            <p className="field-value-muted">No tasks created yet.</p>
          ) : (
            <div className="related-list">
              {tasks.map((task) => (
                <div key={task.id} className="related-item">
                  <div>
                    <div className="related-item-title">
                      {task.title || "Untitled Task"}
                    </div>
                    <div className="related-item-subtitle">
                      Due: {formatDate(task.due_date)} • Priority: {formatLabel(task.priority)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`badge ${getTaskStatusBadge(task.status)}`}>
                      {formatLabel(task.status)}
                    </span>

                    <Link href={`/tasks/${task.id}`} className="btn btn-ghost">
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title !mb-0">Key Access</h2>
            <p className="page-subtitle mt-1">
              Secure access assets linked to this property.
            </p>
          </div>

          <Link href={`/properties/${id}/keys`} className="btn btn-primary">
            Manage Keys
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="summary-item">
            <span className="field-label">Tracked Keys</span>
            <span className="field-value">{keysCount}</span>
          </div>

          <div className="summary-item">
            <span className="field-label">Access Risk</span>
            <span className="field-value">
              {keysCount > 0 ? "Tracked" : "No keys registered"}
            </span>
          </div>

          <div className="summary-item">
            <span className="field-label">Action</span>
            <span className="field-value">
              {keysCount > 0 ? "Review handovers regularly" : "Add first key"}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}