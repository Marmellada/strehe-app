import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { VendorForm } from "@/components/expenses/VendorForm";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";

export default async function NewVendorPage() {
  await requireRole(["admin", "office"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New Vendor"
        description="Create a vendor for future expense records."
        actions={
          <Button asChild variant="ghost">
            <Link href="/settings/vendors">Back to Vendors</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <VendorForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
