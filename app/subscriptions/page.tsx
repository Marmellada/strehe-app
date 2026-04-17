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
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  TableShell,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

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
  physical_contract_confirmed_at: string | null;
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
      physical_contract_confirmed_at,
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

      if (status === "draft") acc.draft += 1;
      else if (status === "prepared") acc.prepared += 1;
      else if (status === "active") acc.active += 1;
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
      draft: 0,
      prepared: 0,
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Contracts" value={summary.total} />
        <StatCard title="Draft" value={summary.draft} />
        <StatCard title="Prepared" value={summary.prepared} />
        <StatCard title="Active" value={summary.active} />
        <StatCard title="Paused" value={summary.paused} />
        <StatCard title="Cancelled" value={summary.cancelled} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Monthly Revenue"
          value={formatPrice(summary.monthlyRevenue)}
        />
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
            <TableShell>
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paper Filed</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {getSingleRelation(contract.client)?.id ? (
                          <Link
                            href={`/clients/${getSingleRelation(contract.client)!.id}`}
                            className="hover:underline"
                          >
                            {getClientName(contract)}
                          </Link>
                        ) : (
                          getClientName(contract)
                        )}
                      </TableCell>

                      <TableCell>
                        {getSingleRelation(contract.property)?.id ? (
                          <Link
                            href={`/properties/${getSingleRelation(contract.property)!.id}`}
                            className="hover:underline"
                          >
                            {getPropertyLabel(contract)}
                          </Link>
                        ) : (
                          getPropertyLabel(contract)
                        )}
                      </TableCell>

                      <TableCell>
                        {getSingleRelation(contract.package)?.id ? (
                          <Link
                            href={`/packages/${getSingleRelation(contract.package)!.id}`}
                            className="hover:underline"
                          >
                            {getPackageName(contract)}
                          </Link>
                        ) : (
                          getPackageName(contract)
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={contract.status} />
                      </TableCell>

                      <TableCell>
                        {contract.physical_contract_confirmed_at
                          ? formatDate(contract.physical_contract_confirmed_at)
                          : "-"}
                      </TableCell>

                      <TableCell>
                        {formatPrice(contract.monthly_price)}
                        {contract.monthly_price !== null &&
                        contract.monthly_price !== undefined &&
                        contract.monthly_price !== ""
                          ? " / mo"
                          : ""}
                      </TableCell>

                      <TableCell>
                        {formatPeriod(contract.start_date, contract.end_date)}
                      </TableCell>

                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
