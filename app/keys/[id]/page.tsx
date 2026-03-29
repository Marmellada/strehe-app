import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AssignKeyButton from "./AssignKeyButton";
import ReturnKeyButton from "./ReturnKeyButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

type RelatedProperty =
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }[]
  | null;

type KeyRecord = {
  id: string;
  key_code: string | null;
  name: string | null;
  key_type: string | null;
  description: string | null;
  status: string | null;
  storage_location: string | null;
  holder_name: string | null;
  last_checked_out_at: string | null;
  created_at: string | null;
  property_id: string | null;
  properties: RelatedProperty;
};

type KeyLog = {
  id: string;
  action: string | null;
  user_name: string | null;
  notes: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function assignKey(keyId: string, formData: FormData) {
  "use server";

  const holder_name = String(formData.get("holder_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!holder_name) {
    throw new Error("Holder name is required.");
  }

  const { data: currentKey, error: currentKeyError } = await supabase
    .from("keys")
    .select("id, status, holder_name")
    .eq("id", keyId)
    .maybeSingle();

  if (currentKeyError || !currentKey) {
    throw new Error("Key not found.");
  }

  if (currentKey.status !== "available") {
    throw new Error("Only available keys can be assigned.");
  }

  const fromStatus = currentKey.status || null;

  const { error: updateError } = await supabase
    .from("keys")
    .update({
      status: "assigned",
      holder_name,
      last_checked_out_at: new Date().toISOString(),
    })
    .eq("id", keyId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: logError } = await supabase.from("key_logs").insert([
    {
      key_id: keyId,
      action: "assigned",
      user_name: holder_name,
      notes: notes || `Key assigned to ${holder_name}`,
      from_status: fromStatus,
      to_status: "assigned",
    },
  ]);

  if (logError) {
    throw new Error(logError.message);
  }

  redirect(`/keys/${keyId}`);
}

async function returnKey(keyId: string, formData: FormData) {
  "use server";

  const notes = String(formData.get("notes") || "").trim();

  const { data: currentKey, error: currentKeyError } = await supabase
    .from("keys")
    .select("id, status, holder_name")
    .eq("id", keyId)
    .maybeSingle();

  if (currentKeyError || !currentKey) {
    throw new Error("Key not found.");
  }

  if (currentKey.status !== "assigned") {
    throw new Error("Only assigned keys can be returned.");
  }

  const fromStatus = currentKey.status || null;
  const previousHolder = currentKey.holder_name || "unknown";

  const { error: updateError } = await supabase
    .from("keys")
    .update({
      status: "available",
      holder_name: null,
      last_checked_out_at: null,
    })
    .eq("id", keyId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: logError } = await supabase.from("key_logs").insert([
    {
      key_id: keyId,
      action: "returned",
      user_name: previousHolder,
      notes: notes || `Key returned from ${previousHolder}`,
      from_status: fromStatus,
      to_status: "available",
    },
  ]);

  if (logError) {
    throw new Error(logError.message);
  }

  redirect(`/keys/${keyId}`);
}

async function markKeyLost(keyId: string, formData: FormData) {
  "use server";

  const user_name = String(formData.get("user_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!user_name) {
    throw new Error("User name is required.");
  }

  const { data: currentKey, error: currentKeyError } = await supabase
    .from("keys")
    .select("id, status, holder_name")
    .eq("id", keyId)
    .maybeSingle();

  if (currentKeyError || !currentKey) {
    throw new Error("Key not found.");
  }

  if (currentKey.status !== "available" && currentKey.status !== "assigned") {
    throw new Error("Only available or assigned keys can be marked as lost.");
  }

  const fromStatus = currentKey.status || null;

  const { error: updateError } = await supabase
    .from("keys")
    .update({
      status: "lost",
      holder_name: null,
    })
    .eq("id", keyId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: logError } = await supabase.from("key_logs").insert([
    {
      key_id: keyId,
      action: "lost",
      user_name,
      notes: notes || "Key marked as lost",
      from_status: fromStatus,
      to_status: "lost",
    },
  ]);

  if (logError) {
    throw new Error(logError.message);
  }

  redirect(`/keys/${keyId}`);
}

async function markKeyDamaged(keyId: string, formData: FormData) {
  "use server";

  const user_name = String(formData.get("user_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!user_name) {
    throw new Error("User name is required.");
  }

  const { data: currentKey, error: currentKeyError } = await supabase
    .from("keys")
    .select("id, status, holder_name")
    .eq("id", keyId)
    .maybeSingle();

  if (currentKeyError || !currentKey) {
    throw new Error("Key not found.");
  }

  if (currentKey.status !== "available" && currentKey.status !== "assigned") {
    throw new Error("Only available or assigned keys can be marked as damaged.");
  }

  const fromStatus = currentKey.status || null;

  const { error: updateError } = await supabase
    .from("keys")
    .update({
      status: "damaged",
      holder_name: null,
    })
    .eq("id", keyId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: logError } = await supabase.from("key_logs").insert([
    {
      key_id: keyId,
      action: "damaged",
      user_name,
      notes: notes || "Key marked as damaged",
      from_status: fromStatus,
      to_status: "damaged",
    },
  ]);

  if (logError) {
    throw new Error(logError.message);
  }

  redirect(`/keys/${keyId}`);
}

async function markKeyRetired(keyId: string, formData: FormData) {
  "use server";

  const user_name = String(formData.get("user_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!user_name) {
    throw new Error("User name is required.");
  }

  const { data: currentKey, error: currentKeyError } = await supabase
    .from("keys")
    .select("id, status, holder_name")
    .eq("id", keyId)
    .maybeSingle();

  if (currentKeyError || !currentKey) {
    throw new Error("Key not found.");
  }

  if (currentKey.status === "retired") {
    throw new Error("This key is already retired.");
  }

  const fromStatus = currentKey.status || null;

  const { error: updateError } = await supabase
    .from("keys")
    .update({
      status: "retired",
      holder_name: null,
    })
    .eq("id", keyId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: logError } = await supabase.from("key_logs").insert([
    {
      key_id: keyId,
      action: "retired",
      user_name,
      notes: notes || "Key marked as retired",
      from_status: fromStatus,
      to_status: "retired",
    },
  ]);

  if (logError) {
    throw new Error(logError.message);
  }

  redirect(`/keys/${keyId}`);
}

export default async function KeyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [{ data: rawKey, error: keyError }, { data: logs, error: logsError }] =
    await Promise.all([
      supabase
        .from("keys")
        .select(
          `
            id,
            key_code,
            name,
            key_type,
            description,
            status,
            storage_location,
            holder_name,
            last_checked_out_at,
            created_at,
            property_id,
            properties (
              id,
              title,
              property_code,
              address_line_1
            )
          `
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("key_logs")
        .select(
          `
            id,
            action,
            user_name,
            notes,
            from_status,
            to_status,
            created_at
          `
        )
        .eq("key_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (keyError || !rawKey) {
    return notFound();
  }

  if (logsError) {
    return <div className="card">Error loading key logs: {logsError.message}</div>;
  }

  const key = rawKey as KeyRecord;
  const property = getSingleRelation(key.properties);
  const keyLogs = (logs || []) as KeyLog[];

  const assignKeyWithId = assignKey.bind(null, id);
  const returnKeyWithId = returnKey.bind(null, id);
  const markKeyLostWithId = markKeyLost.bind(null, id);
  const markKeyDamagedWithId = markKeyDamaged.bind(null, id);
  const markKeyRetiredWithId = markKeyRetired.bind(null, id);

  const isAvailable = key.status === "available";
  const isAssigned = key.status === "assigned";
  const canMarkLostOrDamaged = key.status === "available" || key.status === "assigned";
  const canRetire = key.status !== "retired";

  return (
    <main className="space-y-6">
      <div className="status-row">
        <span className="badge badge-outline">{key.key_type || "Key"}</span>
        <span
          className={`badge ${
            key.status === "available"
              ? "badge-success"
              : key.status === "assigned"
              ? "badge-warning"
              : key.status === "lost"
              ? "badge-danger"
              : key.status === "damaged"
              ? "badge-warning"
              : key.status === "retired"
              ? "badge-outline"
              : "badge-outline"
          }`}
        >
          {key.status || "Unknown"}
        </span>
      </div>

      <div>
        <h1 className="page-title">{key.name || "Unnamed Key"}</h1>
        <p className="page-subtitle mt-2">Tag: {key.key_code || "-"}</p>
      </div>

      <div className="top-actions">
        <Link
          href={property?.id ? `/properties/${property.id}/keys` : "/properties"}
          className="btn btn-ghost"
        >
          ← Back to Keys
        </Link>

        {property?.id ? (
          <Link href={`/properties/${property.id}`} className="btn btn-ghost">
            View Property
          </Link>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <span className="field-label">Key Tag</span>
          <span className="field-value">{key.key_code || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Key Type</span>
          <span className="field-value">{key.key_type || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Current Holder</span>
          <span className="field-value">{key.holder_name || "In storage"}</span>
        </div>

        <div className="card">
          <span className="field-label">Last Checked Out</span>
          <span className="field-value">{formatDate(key.last_checked_out_at)}</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <h2 className="section-title">Key Information</h2>

          <div className="info-stack">
            <div className="info-row">
              <span className="field-label">Name</span>
              <span className="field-value">{key.name || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Tag / Code</span>
              <span className="field-value">{key.key_code || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Status</span>
              <span className="field-value">{key.status || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Storage Location</span>
              <span className="field-value">{key.storage_location || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Description</span>
              <span className="field-value-muted whitespace-pre-wrap">
                {key.description || "-"}
              </span>
            </div>

            <div className="info-row">
              <span className="field-label">Created</span>
              <span className="field-value">{formatDate(key.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Property Summary</h2>

          <div className="summary-stack">
            <div className="summary-item">
              <span className="field-label">Property</span>
              <span className="field-value">{property?.title || "-"}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Property Code</span>
              <span className="field-value">{property?.property_code || "-"}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Address</span>
              <span className="field-value">{property?.address_line_1 || "-"}</span>
            </div>

            {property?.id ? (
              <div className="summary-item pt-2">
                <Link href={`/properties/${property.id}`} className="btn btn-ghost">
                  Open Property
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isAvailable ? (
        <section className="card">
          <div className="mb-4">
            <h2 className="section-title !mb-0">Assign Key</h2>
            <p className="page-subtitle mt-1">
              Record who is taking custody of this key.
            </p>
          </div>

          <form
            action={assignKeyWithId}
            style={{ display: "grid", gap: 16, maxWidth: 720 }}
          >
            <label className="field">
              Holder Name
              <input
                name="holder_name"
                className="input"
                placeholder="e.g. Milot / Contractor / Cleaner"
                required
              />
            </label>

            <label className="field">
              Note
              <textarea
                name="notes"
                className="input"
                rows={3}
                placeholder="Optional note about why the key is being assigned"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <AssignKeyButton />
            </div>
          </form>
        </section>
      ) : null}

      {isAssigned ? (
        <section className="card">
          <div className="mb-4">
            <h2 className="section-title !mb-0">Return Key</h2>
            <p className="page-subtitle mt-1">
              Move the key back into storage and close the custody cycle.
            </p>
          </div>

          <form
            action={returnKeyWithId}
            style={{ display: "grid", gap: 16, maxWidth: 720 }}
          >
            <label className="field">
              Return Note
              <textarea
                name="notes"
                className="input"
                rows={3}
                placeholder="Optional note about the return"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <ReturnKeyButton />
            </div>
          </form>
        </section>
      ) : null}

      {canMarkLostOrDamaged ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-4">
              <h2 className="section-title !mb-0">Mark as Lost</h2>
              <p className="page-subtitle mt-1">
                Use this if the key cannot currently be located.
              </p>
            </div>

            <form
              action={markKeyLostWithId}
              style={{ display: "grid", gap: 16, maxWidth: 720 }}
            >
              <label className="field">
                Reported By
                <input
                  name="user_name"
                  className="input"
                  placeholder="Your name"
                  required
                />
              </label>

              <label className="field">
                Note
                <textarea
                  name="notes"
                  className="input"
                  rows={3}
                  placeholder="Optional note about how or when the key was lost"
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-danger">
                  Mark as Lost
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="mb-4">
              <h2 className="section-title !mb-0">Mark as Damaged</h2>
              <p className="page-subtitle mt-1">
                Use this if the key is broken or no longer usable.
              </p>
            </div>

            <form
              action={markKeyDamagedWithId}
              style={{ display: "grid", gap: 16, maxWidth: 720 }}
            >
              <label className="field">
                Reported By
                <input
                  name="user_name"
                  className="input"
                  placeholder="Your name"
                  required
                />
              </label>

              <label className="field">
                Note
                <textarea
                  name="notes"
                  className="input"
                  rows={3}
                  placeholder="Optional note about the damage"
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-warning">
                  Mark as Damaged
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {canRetire ? (
        <section className="card">
          <div className="mb-4">
            <h2 className="section-title !mb-0">Retire Key</h2>
            <p className="page-subtitle mt-1">
              Permanently remove this key from active use.
            </p>
          </div>

          <form
            action={markKeyRetiredWithId}
            style={{ display: "grid", gap: 16, maxWidth: 720 }}
          >
            <label className="field">
              Retired By
              <input
                name="user_name"
                className="input"
                placeholder="Your name"
                required
              />
            </label>

            <label className="field">
              Note
              <textarea
                name="notes"
                className="input"
                rows={3}
                placeholder="Optional reason for retirement"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-ghost">
                Mark as Retired
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Key History</h2>
          <p className="page-subtitle mt-1">
            Full audit trail of status and custody changes.
          </p>
        </div>

        {keyLogs.length === 0 ? (
          <p className="field-value-muted">No history found for this key.</p>
        ) : (
          <div className="related-list">
            {keyLogs.map((log) => (
              <div key={log.id} className="related-item">
                <div>
                  <div className="related-item-title">
                    {log.action || "Unknown action"}
                  </div>
                  <div className="related-item-subtitle">
                    By: {log.user_name || "system"}
                  </div>
                  <div className="related-item-subtitle">
                    {log.from_status || "-"} → {log.to_status || "-"}
                  </div>
                  {log.notes ? (
                    <div className="related-item-subtitle">{log.notes}</div>
                  ) : null}
                </div>

                <div className="related-item-subtitle">
                  {formatDate(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}