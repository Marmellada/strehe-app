import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/Label";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";

type SearchParams = Promise<{
  status?: string;
  property_id?: string;
  search?: string;
}>;

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

type KeyRow = {
  id: string;
  key_code: string | null;
  name: string | null;
  key_type: string | null;
  status: string | null;
  holder_name: string | null;
  holder_user_id: string | null;
  storage_location: string | null;
  last_checked_out_at: string | null;
  property_id: string | null;
  properties: RelatedProperty;
};

type HolderUser = {
  id: string;
  full_name: string | null;
};

type PropertyOption = {
  id: string;
  title: string | null;
  property_code: string | null;
};

type StatusCountRow = {
  id: string;
  status: string | null;
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

function getKeyTypeVariant(
  _keyType: string | null | undefined
): "neutral" {
  return "neutral";
}

function buildKeysPageHref({
  status,
  property_id,
  search,
}: {
  status?: string;
  property_id?: string;
  search?: string;
}) {
  const params = new URLSearchParams();

  if (status) params.set("status", status);
  if (property_id) params.set("property_id", property_id);
  if (search) params.set("search", search);

  const query = params.toString();
  return query ? `/keys?${query}` : "/keys";
}

export default async function KeysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { appUser } = await requireRole(["admin", "office", "field"]);

  const supabase = await createClient();
  const params = await searchParams;

  const status = params.status || "";
  const property_id = params.property_id || "";
  const search = params.search || "";

  const [
    { data: properties },
    { data: allKeys },
    { data: filteredKeys, error },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, property_code")
      .order("title"),

    supabase.from("keys").select("id, status"),

    (async () => {
      let query = supabase
        .from("keys")
        .select(
          `
            id,
            key_code,
            name,
            key_type,
            status,
            holder_name,
            holder_user_id,
            storage_location,
            last_checked_out_at,
            property_id,
            properties (
              id,
              title,
              property_code,
              address_line_1
            )
          `
        )
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      if (property_id) {
        query = query.eq("property_id", property_id);
      }

      if (search) {
        query = query.or(
          [
            `name.ilike.%${search}%`,
            `key_code.ilike.%${search}%`,
            `key_type.ilike.%${search}%`,
            `holder_name.ilike.%${search}%`,
            `storage_location.ilike.%${search}%`,
          ].join(",")
        );
      }

      return await query;
    })(),
  ]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Keys"
          description="Operational overview of all keys across properties."
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Error loading keys: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const propertyOptions = (properties || []) as PropertyOption[];
  const keys = (filteredKeys || []) as KeyRow[];
  const allKeyRows = (allKeys || []) as StatusCountRow[];
  const holderUserIds = Array.from(
    new Set(
      keys
        .map((key) => key.holder_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let holderUserMap = new Map<string, HolderUser>();

  if (holderUserIds.length > 0) {
    const { data: holderUsers, error: holderUsersError } = await supabase
      .from("app_users")
      .select("id, full_name")
      .in("id", holderUserIds);

    if (holderUsersError) {
      throw new Error(`Failed to load key holders: ${holderUsersError.message}`);
    }

    holderUserMap = new Map(
      ((holderUsers || []) as HolderUser[]).map((user) => [user.id, user])
    );
  }

  const counts = allKeyRows.reduce(
    (acc, row) => {
      const currentStatus = row.status || "unknown";

      acc.total += 1;

      if (currentStatus === "available") acc.available += 1;
      else if (currentStatus === "assigned") acc.assigned += 1;
      else if (currentStatus === "lost") acc.lost += 1;
      else if (currentStatus === "damaged") acc.damaged += 1;
      else if (currentStatus === "retired") acc.retired += 1;
      else acc.other += 1;

      return acc;
    },
    {
      total: 0,
      available: 0,
      assigned: 0,
      lost: 0,
      damaged: 0,
      retired: 0,
      other: 0,
    }
  );

  const statusLinks = [
    { label: "All", value: "", count: counts.total },
    { label: "Available", value: "available", count: counts.available },
    { label: "Assigned", value: "assigned", count: counts.assigned },
    { label: "Lost", value: "lost", count: counts.lost },
    { label: "Damaged", value: "damaged", count: counts.damaged },
    { label: "Retired", value: "retired", count: counts.retired },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keys"
        description="Operational overview of all keys across properties."
      />

      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Signed in as:{" "}
        <span className="font-medium text-foreground">{appUser.role}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              All Keys
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {counts.total}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {counts.available}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assigned
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {counts.assigned}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lost
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {counts.lost}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Damaged
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {counts.damaged}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Retired
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {counts.retired}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Status Filters</CardTitle>
          <CardDescription>
            Jump between lifecycle states quickly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusLinks.map((item) => {
              const active = status === item.value;

              return (
                <Link
                  key={item.label}
                  href={buildKeysPageHref({
                    status: item.value,
                    property_id,
                    search,
                  })}
                >
                  <Button variant={active ? "default" : "outline"} size="sm">
                    {item.label} ({item.count})
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Narrow the list by property, status, or keyword.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            method="get"
          >
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="input"
              >
                <option value="">All statuses</option>
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="lost">Lost</option>
                <option value="damaged">Damaged</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property_id">Property</Label>
              <select
                id="property_id"
                name="property_id"
                defaultValue={property_id}
                className="input"
              >
                <option value="">All properties</option>
                {propertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title || "Untitled Property"}
                    {property.property_code
                      ? ` (${property.property_code})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <input
                id="search"
                name="search"
                className="input"
                defaultValue={search}
                placeholder="Name, code, holder, storage..."
              />
            </div>

            <div className="flex items-end gap-3">
              <Button type="submit">Apply Filters</Button>

              <Link href="/keys">
                <Button variant="outline">Reset</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keys List</CardTitle>
          <CardDescription>
            {keys.length} key{keys.length === 1 ? "" : "s"} found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <EmptyState
              title="No keys found"
              description="No keys match the current filters."
            />
          ) : (
            <div className="space-y-3">
              {keys.map((key) => {
                const property = getSingleRelation(key.properties);
                const holderUser = key.holder_user_id
                  ? holderUserMap.get(key.holder_user_id) || null
                  : null;

                const holderDisplay =
                  holderUser?.full_name ?? key.holder_name ?? "In storage";

                return (
                  <div
                    key={key.id}
                    className="rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-foreground">
                            {key.name || "Unnamed Key"}
                          </div>

                          <Badge variant={getStatusVariant(key.status)}>
                            {formatStatusLabel(key.status)}
                          </Badge>

                          {key.key_type ? (
                            <Badge variant={getKeyTypeVariant(key.key_type)}>
                              {formatStatusLabel(key.key_type)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Tag
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {key.key_code || "-"}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Holder
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {holderDisplay}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Storage
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {key.storage_location || "-"}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Last Checked Out
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {formatDate(key.last_checked_out_at)}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Property
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {property?.title || "-"}
                              {property?.property_code
                                ? ` (${property.property_code})`
                                : ""}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Address
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {property?.address_line_1 || "-"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Link href={`/keys/${key.id}`}>
                          <Button variant="outline">Open</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
