import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { VendorForm } from "@/components/expenses/VendorForm";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditVendorPage({ params }: Props) {
  await requireRole(["admin", "office"]);

  const { id } = await params;
  const supabase = await createClient();

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, name, contact_person, email, phone, address, notes, is_active")
    .eq("id", id)
    .single();

  if (error || !vendor) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit Vendor"
        description="Update vendor details and active or inactive state."
        actions={
          <Button asChild variant="ghost">
            <Link href="/settings/vendors">Back to Vendors</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <VendorForm mode="edit" initialValues={vendor} />
        </CardContent>
      </Card>
    </div>
  );
}
