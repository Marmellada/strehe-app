import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type ClientRelation =
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }[]
  | null;

type PropertyRelation =
  | {
      id: string;
      title: string | null;
      property_code: string | null;
    }
  | {
      id: string;
      title: string | null;
      property_code: string | null;
    }[]
  | null;

type PackageRelation =
  | {
      id: string;
      name: string | null;
    }
  | {
      id: string;
      name: string | null;
    }[]
  | null;

type ContractRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  monthly_price: number | string | null;
  client_name_snapshot: string | null;
  property_code_snapshot: string | null;
  package_name_snapshot: string | null;
  client: ClientRelation;
  property: PropertyRelation;
  package: PackageRelation;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start === "-" && end === "-") return "-";
  if (start !== "-" && end === "-") return `${start} → Open`;
  if (start === "-" && end !== "-") return `Until ${end}`;

  return `${start} → ${end}`;
}

function getBadgeVariant(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "success" as const;
    case "paused":
      return "info" as const;
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function getClientName(row: ContractRow) {
  if (row.client_name_snapshot) return row.client_name_snapshot;

  const client = getSingleRelation(row.client);
  return client?.company_name || client?.full_name || "-";
}

function getPropertyLabel(row: ContractRow) {
  if (row.property_code_snapshot) return row.property_code_snapshot;

  const property = getSingleRelation(row.property);

  if (!property) return "-";

  return property.property_code
    ? `${property.property_code} - ${property.title || ""}`
    : property.title || "-";
}

function getPackageName(row: ContractRow) {
  if (row.package_name_snapshot) return row.package_name_snapshot;

  const pkg = getSingleRelation(row.package);
  return pkg?.name || "-";
}

export default async function SubscriptionsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();

  const { data: contracts, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      start_date,
      end_date,
      status,
      monthly_price,
      client_name_snapshot,
      property_code_snapshot,
      package_name_snapshot,
      client:clients!subscriptions_client_fk (
        id,
        full_name,
        company_name
      ),
      property:properties!subscriptions_property_fk (
        id,
        title,
        property_code
      ),
      package:packages!subscriptions_package_fk (
        id,
        name
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (contracts || []) as ContractRow[];

  const summary = rows.reduce(
    (acc, contract) => {
      const status = (contract.status || "").toLowerCase();
      const monthlyPrice = Number(contract.monthly_price || 0);

      acc.total += 1;

      if (status === "active") acc.active += 1;
      else if (status === "paused") acc.paused += 1;
      else if (status === "cancelled") acc.cancelled += 1;
      else acc.other += 1;

      if (!Number.isNaN(monthlyPrice) && status === "active") {
        acc.monthlyRevenue += monthlyPrice;
      }

      return acc;
    },
    {
      total: 0,
      active: 0,
      paused: 0,
      cancelled: 0,
      other: 0,
      monthlyRevenue: 0,
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Manage service agreements for properties and owners"
        actions={
          <Button asChild>
            <Link href="/subscriptions/create">New Contract</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.active}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.paused}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary.cancelled}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatPrice(summary.monthlyRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contracts List</CardTitle>
          <CardDescription>
            {rows.length} contract{rows.length === 1 ? "" : "s"} found
          </CardDescription>
        </CardHeader>

        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="No contracts found"
              description="Create your first contract to link a client, property, and package."
              action={
                <Button asChild>
                  <Link href="/subscriptions/create">New Contract</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Client
                    </th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Property
                    </th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Package
                    </th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Price
                    </th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Period
                    </th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((contract) => (
                    <tr key={contract.id} className="border-b last:border-b-0">
                      <td className="px-2 py-4 font-medium">
                        {getClientName(contract)}
                      </td>

                      <td className="px-2 py-4">{getPropertyLabel(contract)}</td>

                      <td className="px-2 py-4">{getPackageName(contract)}</td>

                      <td className="px-2 py-4">
                        <Badge variant={getBadgeVariant(contract.status)}>
                          {formatLabel(contract.status)}
                        </Badge>
                      </td>

                      <td className="px-2 py-4">
                        {formatPrice(contract.monthly_price)}
                        {contract.monthly_price !== null &&
                        contract.monthly_price !== undefined &&
                        contract.monthly_price !== ""
                          ? " / mo"
                          : ""}
                      </td>

                      <td className="px-2 py-4">
                        {formatPeriod(contract.start_date, contract.end_date)}
                      </td>

                      <td className="px-2 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/subscriptions/${contract.id}`}>
                              Open
                            </Link>
                          </Button>

                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/subscriptions/${contract.id}/pdf`}
                              target="_blank"
                            >
                              PDF
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
