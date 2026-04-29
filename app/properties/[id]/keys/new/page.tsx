import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  FormField,
  Input,
  PageHeader,
  SectionCard,
  Textarea,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { createClient as createServerClient } from "@/lib/supabase/server";

async function createKey(propertyId: string, formData: FormData) {
  "use server";

  const { authUser, appUser } = await requireRole(["admin", "office"]);
  const supabase = await createServerClient();

  const name = String(formData.get("name") || "").trim();
  const key_type = String(formData.get("key_type") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const storage_location = String(formData.get("storage_location") || "").trim();

  const payload = {
    property_id: propertyId,
    name,
    key_type: key_type || null,
    description: description || null,
    storage_location: storage_location || null,
    status: "available",
    holder_name: null,
    last_checked_out_at: null,
  };

  const { data, error } = await supabase
    .from("keys")
    .insert([payload])
    .select("id, key_code")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("key_logs").insert([
    {
      key_id: data.id,
      action: "created",
      performed_by_user_id: authUser.id,
      user_name: appUser.full_name || authUser.email || authUser.id,
      notes: `Key registered in storage with code ${data.key_code}`,
      from_status: null,
      to_status: "available",
    },
  ]);

  redirect(`/properties/${propertyId}/keys`);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewPropertyKeyPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, title, property_code, address_line_1")
    .eq("id", id)
    .maybeSingle();

  if (error || !property) {
    return notFound();
  }

  const createKeyWithPropertyId = createKey.bind(null, id);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Add Key"
        subtitle={`${property.title || "Untitled Property"} • ${property.property_code || "-"}`}
        actions={
          <Button asChild variant="ghost">
            <Link href={`/properties/${id}/keys`}>Back to Keys</Link>
          </Button>
        }
      />

      <form
        action={createKeyWithPropertyId}
        className="space-y-6"
      >
        <Alert>
          <AlertTitle>Key code is generated automatically</AlertTitle>
          <AlertDescription>
            The backend will assign the next available key tag when you save.
          </AlertDescription>
        </Alert>

        <SectionCard
          title="New Key"
          description="Register a new property key or key bundle with its storage details."
        >
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Key Type">
                <Input
                  name="key_type"
                  placeholder="e.g. Main door / Bundle"
                />
              </FormField>

              <FormField label="Storage Location">
                <Input
                  name="storage_location"
                  placeholder="e.g. Office Safe / Box A / Slot 03"
                />
              </FormField>
            </div>

            <FormField label="Key Name *">
              <Input
                name="name"
                placeholder="e.g. Main Door Key Set"
                required
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                name="description"
                rows={4}
                placeholder="Notes about this key or bundle..."
              />
            </FormField>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href={`/properties/${id}/keys`}>Cancel</Link>
          </Button>
          <Button type="submit">Save Key</Button>
        </div>
      </form>
    </main>
  );
}
