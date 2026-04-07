import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { toggleVendorActiveAction } from "@/lib/actions/vendors";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Manage vendors used on expense records. Inactive vendors remain visible on historical expenses.
          </p>
        </div>

        <Link
          href="/settings/vendors/new"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          New vendor
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Vendor</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors?.map((vendor) => (
              <tr key={vendor.id} className="border-t">
                <td className="px-4 py-3 font-medium">{vendor.name}</td>
                <td className="px-4 py-3">{vendor.contact_person || "—"}</td>
                <td className="px-4 py-3">{vendor.email || "—"}</td>
                <td className="px-4 py-3">{vendor.phone || "—"}</td>
                <td className="px-4 py-3">{vendor.is_active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/settings/vendors/${vendor.id}/edit`}
                      className="rounded-md border px-3 py-1.5 text-sm"
                    >
                      Edit
                    </Link>

                    <form action={toggleVendorActiveAction}>
                      <input type="hidden" name="id" value={vendor.id} />
                      <input type="hidden" name="next_is_active" value={String(!vendor.is_active)} />
                      <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">
                        {vendor.is_active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {!vendors?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No vendors found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}