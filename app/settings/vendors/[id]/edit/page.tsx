import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { VendorForm } from "@/components/expenses/VendorForm";

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
      <div className="space-y-2">
        <Link href="/settings/vendors" className="text-sm text-muted-foreground hover:underline">
          ← Back to vendors
        </Link>
        <h1 className="text-2xl font-semibold">Edit Vendor</h1>
        <p className="text-sm text-muted-foreground">
          Update vendor details and active/inactive state.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <VendorForm mode="edit" initialValues={vendor} />
      </div>
    </div>
  );
}