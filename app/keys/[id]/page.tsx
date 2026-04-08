// app/keys/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getActiveUsers } from "@/lib/users";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import KeyStatusActionForm from './KeyStatusActionForm'
import {
  assignKey,
  returnKey,
  markKeyAsLost,
  markKeyAsDamaged,
  markKeyAsRetired,
} from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

type RelatedProperty = {
  id: string;
  title: string | null;
  property_code: string | null;
  address_line_1: string | null;
} | null;

type HolderUser = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type KeyRecord = {
  id: string;
  key_code: string | null;
  name: string | null;
  key_type: string | null;
  description: string | null;
  status: string | null;
  storage_location: string | null;
  holder_name: string | null;
  holder_user_id: string | null;
  last_checked_out_at: string | null;
  created_at: string | null;
  property_id: string | null;
  properties: RelatedProperty | RelatedProperty[];
};

type KeyLog = {
  id: string;
  action: string | null;
  notes: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string | null;
  performed_by_user_id: string | null;
  user_name: string | null;
};

function getSingle<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
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

function getKeyStatusVariant(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "available":
      return "success" as const;
    case "assigned":
    case "damaged":
      return "warning" as const;
    case "lost":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default async function KeyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [{ data: rawKey, error: keyError }, { data: logs, error: logsError }, users] =
    await Promise.all([
      supabase
        .from("keys")
        .select(
          `
            id, key_code, name, key_type, description, status,
            storage_location, holder_name, holder_user_id,
            last_checked_out_at, created_at, property_id,
            properties ( id, title, property_code, address_line_1 )
          `
        )
        .eq("id", id)
        .maybeSingle(),

      supabase
        .from("key_logs")
        .select(
          `
            id, action, notes, from_status, to_status, created_at,
            user_name,
            performed_by_user_id
          `
        )
        .eq("key_id", id)
        .order("created_at", { ascending: false }),

      getActiveUsers(),
    ]);

  if (keyError || !rawKey) return notFound();
  if (logsError) {
    return <div className="card">Error loading key logs: {logsError.message}</div>;
  }

  const key = rawKey as KeyRecord;
  const property = getSingle(key.properties);
  const keyLogs = (logs || []) as KeyLog[];
  const userIdsToLoad = Array.from(
    new Set(
      [
        key.holder_user_id,
        ...keyLogs.map((log) => log.performed_by_user_id),
      ].filter((value): value is string => Boolean(value))
    )
  );

  let userMap = new Map<string, HolderUser>();

  if (userIdsToLoad.length > 0) {
    const { data: appUsers, error: appUsersError } = await supabase
      .from("app_users")
      .select("id, full_name, role")
      .in("id", userIdsToLoad);

    if (appUsersError) {
      return <div className="card">Error loading key users: {appUsersError.message}</div>;
    }

    userMap = new Map(
      ((appUsers || []) as HolderUser[]).map((user) => [user.id, user])
    );
  }

  const holderUser = key.holder_user_id
    ? userMap.get(key.holder_user_id) || null
    : null;

  const holderDisplay = holderUser?.full_name ?? key.holder_name ?? "In storage";

  const isAvailable        = key.status === "available";
  const isAssigned         = key.status === "assigned";
  const canMarkLostDamaged = key.status === "available" || key.status === "assigned";
  const canRetire          = key.status !== "retired";

  return (
    <main className="space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title={key.name || "Unnamed Key"}
        description={`Tag: ${key.key_code || "-"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={property?.id ? `/properties/${property.id}/keys` : "/keys"}>
                Back to Keys
              </Link>
            </Button>

            {property?.id ? (
              <Button asChild variant="outline">
                <Link href={`/properties/${property.id}`}>View Property</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{key.key_type || "Key"}</Badge>
        <Badge variant={getKeyStatusVariant(key.status)}>
          {key.status || "Unknown"}
        </Badge>
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
          <span className="field-value">{holderDisplay}</span>
        </div>
        <div className="card">
          <span className="field-label">Last Checked Out</span>
          <span className="field-value">{formatDate(key.last_checked_out_at)}</span>
        </div>
      </section>

      {/* ── Info + Property ── */}
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
              <span className="field-label">Current Holder</span>
              <span className="field-value">{holderDisplay}</span>
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

      {/* ── Assign ── */}
      {isAvailable ? (
        <section className="card">
          <div className="mb-4">
            <h2 className="section-title !mb-0">Assign Key</h2>
            <p className="page-subtitle mt-1">
              Record who is taking custody of this key.
            </p>
          </div>
          <form action={assignKey} className="grid max-w-[720px] gap-4">
            <input type="hidden" name="key_id" value={id} />
            <label className="field">
              Assign To
              <select name="holder_user_id" className="input" required>
                <option value="">Select person...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || "Unnamed"}{u.role ? ` — ${u.role}` : ""}
                  </option>
                ))}
              </select>
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
            <div className="flex justify-end">
              <Button type="submit">
                Assign Key
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {/* ── Return ── */}
      {isAssigned ? (
        <section className="card">
          <div className="mb-4">
            <h2 className="section-title !mb-0">Return Key</h2>
            <p className="page-subtitle mt-1">
              Move the key back into storage and close the custody cycle.
            </p>
          </div>
          <KeyStatusActionForm
            action={returnKey}
            keyId={id}
            label="Return Key"
            defaultNote="Key returned."
            users={users}
            variant="primary"
          />
        </section>
      ) : null}

      {/* ── Lost / Damaged ── */}
      {canMarkLostDamaged ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-4">
              <h2 className="section-title !mb-0">Mark as Lost</h2>
              <p className="page-subtitle mt-1">
                Use this if the key cannot currently be located.
              </p>
            </div>
            <KeyStatusActionForm
              action={markKeyAsLost}
              keyId={id}
              label="Mark as Lost"
              defaultNote="Key marked as lost."
              users={users}
              variant="danger"
            />
          </div>
          <div className="card">
            <div className="mb-4">
              <h2 className="section-title !mb-0">Mark as Damaged</h2>
              <p className="page-subtitle mt-1">
                Use this if the key is broken or no longer usable.
              </p>
            </div>
            <KeyStatusActionForm
              action={markKeyAsDamaged}
              keyId={id}
              label="Mark as Damaged"
              defaultNote="Key marked as damaged."
              users={users}
              variant="warning"
            />
          </div>
        </section>
      ) : null}

      {/* ── Retire ── */}
      {canRetire ? (
        <section className="card">
          <div className="mb-4">
            <h2 className="section-title !mb-0">Retire Key</h2>
            <p className="page-subtitle mt-1">
              Permanently remove this key from active use.
            </p>
          </div>
          <KeyStatusActionForm
            action={markKeyAsRetired}
            keyId={id}
            label="Mark as Retired"
            defaultNote="Key retired from active use."
            users={users}
            variant="ghost"
          />
        </section>
      ) : null}

      {/* ── History ── */}
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
            {keyLogs.map((log) => {
              const performer = log.performed_by_user_id
                ? userMap.get(log.performed_by_user_id) || null
                : null;
              const performerDisplay =
                performer?.full_name ?? log.user_name ?? "system";
              return (
                <div key={log.id} className="related-item">
                  <div>
                    <div className="related-item-title">
                      {log.action || "Unknown action"}
                    </div>
                    <div className="related-item-subtitle">
                      By: {performerDisplay}
                      {performer?.role ? ` (${performer.role})` : ""}
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
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
