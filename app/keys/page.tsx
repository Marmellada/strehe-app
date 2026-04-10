import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  FormField,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Input,
} from "@/components/ui";
import { formatStatusLabel } from "@/lib/ui/status";

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
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
        <Alert variant="destructive">
          <AlertTitle>Unable to load keys</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
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
        <StatCard title="All Keys" value={counts.total} />
        <StatCard title="Available" value={counts.available} />
        <StatCard title="Assigned" value={counts.assigned} />
        <StatCard title="Lost" value={counts.lost} />
        <StatCard title="Damaged" value={counts.damaged} />
        <StatCard title="Retired" value={counts.retired} />
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
            <FormField id="status" label="Status">
              <select
                id="status"
                name="status"
                defaultValue={status}
                className={nativeSelectClassName}
              >
                <option value="">All statuses</option>
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="lost">Lost</option>
                <option value="damaged">Damaged</option>
                <option value="retired">Retired</option>
              </select>
            </FormField>

            <FormField id="property_id" label="Property">
              <select
                id="property_id"
                name="property_id"
                defaultValue={property_id}
                className={nativeSelectClassName}
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
            </FormField>

            <FormField id="search" label="Search">
              <Input
                id="search"
                name="search"
                defaultValue={search}
                placeholder="Name, code, holder, storage..."
              />
            </FormField>

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
            <TableShell className="rounded-none border-x-0 border-b-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Holder</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Last Checked Out</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
              {keys.map((key) => {
                const property = getSingleRelation(key.properties);
                const holderUser = key.holder_user_id
                  ? holderUserMap.get(key.holder_user_id) || null
                  : null;

                const holderDisplay =
                  holderUser?.full_name ?? key.holder_name ?? "In storage";

                return (
                  <TableRow
                    key={key.id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground">
                          {key.name || "Unnamed Key"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tag: {key.key_code || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.key_type ? formatStatusLabel(key.key_type) : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={key.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {holderDisplay}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.storage_location || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{property?.title || "-"}</div>
                      {property?.property_code ? (
                        <div className="text-xs text-muted-foreground">
                          {property.property_code}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.last_checked_out_at)}
                    </TableCell>
                    <TableCell className="text-right">
                        <Link href={`/keys/${key.id}`}>
                          <Button variant="outline">Open</Button>
                        </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
                  </TableBody>
                </Table>
              </div>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
