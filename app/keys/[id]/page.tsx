// app/keys/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getActiveUsers } from "@/lib/users";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DetailField,
  FormField,
  PageHeader,
  SectionCard,
  StatusBadge,
  Textarea,
} from "@/components/ui";
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

export default async function KeyDetailPage({ params }: PageProps) {
  const { appUser } = await requireRole(["admin", "office", "field"]);
  const { id } = await params;
  const supabase = await createClient();
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load key history</AlertTitle>
        <AlertDescription>{logsError.message}</AlertDescription>
      </Alert>
    );
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
      return (
        <Alert variant="destructive">
          <AlertTitle>Unable to load key users</AlertTitle>
          <AlertDescription>{appUsersError.message}</AlertDescription>
        </Alert>
      );
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
  const canManageCustody = appUser.role === "admin" || appUser.role === "office";

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
        <StatusBadge status={key.status} fallbackLabel="Unknown" />
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        <SectionCard title="Key Tag" contentClassName="pt-0">
          <div className="text-base font-medium text-foreground">{key.key_code || "-"}</div>
        </SectionCard>
        <SectionCard title="Key Type" contentClassName="pt-0">
          <div className="text-base font-medium text-foreground">{key.key_type || "-"}</div>
        </SectionCard>
        <SectionCard title="Current Holder" contentClassName="pt-0">
          <div className="text-base font-medium text-foreground">{holderDisplay}</div>
        </SectionCard>
        <SectionCard title="Last Checked Out" contentClassName="pt-0">
          <div className="text-base font-medium text-foreground">{formatDate(key.last_checked_out_at)}</div>
        </SectionCard>
      </section>

      {/* ── Info + Property ── */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard title="Key Information">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Name" value={key.name || "-"} />
            <DetailField label="Tag / Code" value={key.key_code || "-"} />
            <DetailField label="Status" value={key.status || "-"} />
            <DetailField label="Current Holder" value={holderDisplay} />
            <DetailField label="Storage Location" value={key.storage_location || "-"} />
            <DetailField label="Created" value={formatDate(key.created_at)} />
            <DetailField
              className="md:col-span-2"
              label="Description"
              value={
                <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {key.description || "-"}
                </div>
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Property Summary">
          <div className="grid gap-4">
            <DetailField label="Property" value={property?.title || "-"} />
            <DetailField label="Property Code" value={property?.property_code || "-"} />
            <DetailField label="Address" value={property?.address_line_1 || "-"} />
            {property?.id ? (
              <div className="pt-2">
                <Button asChild variant="ghost">
                  <Link href={`/properties/${property.id}`}>Open Property</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </section>

      {/* ── Assign ── */}
      {canManageCustody && isAvailable ? (
        <SectionCard
          title="Assign Key"
          description="Record who is taking custody of this key."
        >
          <div className="max-w-[720px]">
          <form action={assignKey} className="grid gap-4">
            <input type="hidden" name="key_id" value={id} />
            <FormField id="assign-holder-user" label="Assign To" required>
              <select
                id="assign-holder-user"
                name="holder_user_id"
                className={nativeSelectClassName}
                required
              >
                <option value="">Select person...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || "Unnamed"}{u.role ? ` — ${u.role}` : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="assign-notes" label="Note">
              <Textarea
                id="assign-notes"
                name="notes"
                rows={3}
                placeholder="Optional note about why the key is being assigned"
              />
            </FormField>
            <div className="flex justify-end">
              <Button type="submit">
                Assign Key
              </Button>
            </div>
          </form>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Return ── */}
      {canManageCustody && isAssigned ? (
        <SectionCard
          title="Return Key"
          description="Move the key back into storage and close the custody cycle."
        >
          <KeyStatusActionForm
            action={returnKey}
            keyId={id}
            label="Return Key"
            defaultNote="Key returned."
            description="This action is recorded under your account automatically."
            variant="primary"
          />
        </SectionCard>
      ) : null}

      {/* ── Lost / Damaged ── */}
      {canManageCustody && canMarkLostDamaged ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Mark as Lost"
            description="Use this if the key cannot currently be located."
          >
            <KeyStatusActionForm
              action={markKeyAsLost}
              keyId={id}
              label="Mark as Lost"
              defaultNote="Key marked as lost."
              description="This action is recorded under your account automatically."
              variant="danger"
            />
          </SectionCard>
          <SectionCard
            title="Mark as Damaged"
            description="Use this if the key is broken or no longer usable."
          >
            <KeyStatusActionForm
              action={markKeyAsDamaged}
              keyId={id}
              label="Mark as Damaged"
              defaultNote="Key marked as damaged."
              description="This action is recorded under your account automatically."
              variant="warning"
            />
          </SectionCard>
        </section>
      ) : null}

      {/* ── Retire ── */}
      {canManageCustody && canRetire ? (
        <SectionCard
          title="Retire Key"
          description="Permanently remove this key from active use."
        >
          <KeyStatusActionForm
            action={markKeyAsRetired}
            keyId={id}
            label="Mark as Retired"
            defaultNote="Key retired from active use."
            description="This action is recorded under your account automatically."
            variant="ghost"
          />
        </SectionCard>
      ) : null}

      {!canManageCustody ? (
        <Alert>
          <AlertTitle>View-only access</AlertTitle>
          <AlertDescription>
            Custody and status changes for keys are limited to office and admin users.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ── History ── */}
      <SectionCard
        title="Key History"
        description="Full audit trail of status and custody changes."
      >
        {keyLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history found for this key.</p>
        ) : (
          <div className="space-y-3">
            {keyLogs.map((log) => {
              const performer = log.performed_by_user_id
                ? userMap.get(log.performed_by_user_id) || null
                : null;
              const performerDisplay =
                performer?.full_name ?? log.user_name ?? "system";
              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {log.action || "Unknown action"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      By: {performerDisplay}
                      {performer?.role ? ` (${performer.role})` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.from_status || "-"} → {log.to_status || "-"}
                    </div>
                    {log.notes ? (
                      <div className="text-sm text-muted-foreground">{log.notes}</div>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </main>
  );
}
