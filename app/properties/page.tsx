import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";

type RelatedName = { name: string | null } | { name: string | null }[] | null;

type PropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
  address_line_1: string | null;
  property_type: string | null;
  status: string | null;
  municipalities: RelatedName;
  locations: RelatedName;
};

type Municipality = {
  id: string;
  name: string;
};

function getRelatedName(value: RelatedName) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name || "";
  return value.name || "";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipality_id?: string;
    status?: string;
    search?: string;
  }>;
}) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const params = await searchParams;

  const municipalityId = params.municipality_id || "";
  const status = params.status || "";
  const search = params.search || "";
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  let propertiesQuery = supabase.from("properties").select(`
      id,
      property_code,
      title,
      address_line_1,
      property_type,
      status,
      municipalities(name),
      locations(name)
    `);

  if (municipalityId) {
    propertiesQuery = propertiesQuery.eq("municipality_id", municipalityId);
  }

  if (status) {
    propertiesQuery = propertiesQuery.eq("status", status);
  }

  if (search) {
    propertiesQuery = propertiesQuery.or(
      `title.ilike.%${search}%,property_code.ilike.%${search}%,address_line_1.ilike.%${search}%`
    );
  }

  const [
    propertiesResult,
    municipalitiesResult,
    totalPropertiesResult,
    activePropertiesResult,
    vacantPropertiesResult,
    inactivePropertiesResult,
  ] = await Promise.all([
    propertiesQuery.order("id", { ascending: false }),
    supabase.from("municipalities").select("id, name").order("name"),
    supabase.from("properties").select("*", { count: "exact", head: true }),
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "vacant"),
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "inactive"),
  ]);

  if (propertiesResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Properties"
          description="Manage all registered properties."
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Error loading properties: {propertiesResult.error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (municipalitiesResult.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Properties"
          description="Manage all registered properties."
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Error loading municipalities: {municipalitiesResult.error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const properties = (propertiesResult.data || []) as PropertyRow[];
  const municipalities = (municipalitiesResult.data || []) as Municipality[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage all registered properties."
        actions={
          <Link href="/properties/new">
            <Button>New Property</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Properties
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {totalPropertiesResult.count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {activePropertiesResult.count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vacant
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {vacantPropertiesResult.count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Inactive
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {inactivePropertiesResult.count ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <form method="GET" className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              name="search"
              placeholder="Search title, code, or address..."
              defaultValue={search}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="municipality_id">Municipality</Label>
            <select
              id="municipality_id"
              name="municipality_id"
              defaultValue={municipalityId}
              className={nativeSelectClassName}
            >
              <option value="">All municipalities</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className={nativeSelectClassName}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="vacant">Vacant</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-end gap-3 md:col-span-4">
            <Button type="submit">Apply</Button>
            <Link href="/properties">
              <Button variant="outline">Clear</Button>
            </Link>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {properties.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No properties found"
              description="Try changing the filters or create your first property."
              action={
                <Link href="/properties/new">
                  <Button>New Property</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Property
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Location
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {properties.map((property) => {
                  const municipalityName = getRelatedName(
                    property.municipalities
                  );
                  const locationName = getRelatedName(property.locations);
                  const locationLine = [locationName, municipalityName]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr
                      key={property.id}
                      className="border-b last:border-none transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">
                            {property.title || "Untitled property"}
                          </div>

                          <div className="mt-1 text-sm text-muted-foreground">
                            {property.property_code || "No code"}
                            {property.address_line_1
                              ? ` • ${property.address_line_1}`
                              : ""}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {locationLine || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant="neutral">
                          {formatStatusLabel(property.property_type) || "Property"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={getStatusVariant(property.status)}>
                          {formatStatusLabel(property.status)}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/properties/${property.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>

                          <Link href={`/properties/${property.id}/edit`}>
                            <Button size="sm">Edit</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
