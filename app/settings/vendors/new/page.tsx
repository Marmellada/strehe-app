import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { VendorForm } from "@/components/expenses/VendorForm";

export default async function NewVendorPage() {
  await requireRole(["admin", "office"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/settings/vendors" className="text-sm text-muted-foreground hover:underline">
          ← Back to vendors
        </Link>
        <h1 className="text-2xl font-semibold">New Vendor</h1>
        <p className="text-sm text-muted-foreground">
          Create a vendor for future expense records.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <VendorForm mode="create" />
      </div>
    </div>
  );
}