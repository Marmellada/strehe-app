import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { toggleVendorActiveAction } from "@/lib/actions/vendors";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

type VendorRow = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
};

export default async function VendorsPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("id, name, contact_person, email, phone, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (vendors || []) as VendorRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage vendors used on expense records. Inactive vendors remain visible on historical expenses."
        actions={
          <Button asChild>
            <Link href="/settings/vendors/new">New Vendor</Link>
          </Button>
        }
      />

      <TableShell>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No vendors found"
              description="Create your first vendor to keep expense records connected to real suppliers and service providers."
              action={
                <Button asChild>
                  <Link href="/settings/vendors/new">New Vendor</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.contact_person || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={vendor.is_active ? "active" : "inactive"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/settings/vendors/${vendor.id}/edit`}>
                            Edit
                          </Link>
                        </Button>

                        <form action={toggleVendorActiveAction}>
                          <input type="hidden" name="id" value={vendor.id} />
                          <input
                            type="hidden"
                            name="next_is_active"
                            value={String(!vendor.is_active)}
                          />
                          <Button
                            type="submit"
                            variant={vendor.is_active ? "outline" : "default"}
                            size="sm"
                          >
                            {vendor.is_active ? "Disable" : "Enable"}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TableShell>
    </div>
  );
}
