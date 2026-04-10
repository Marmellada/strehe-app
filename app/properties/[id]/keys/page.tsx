import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Button,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyKeysPage({ params }: PageProps) {
  const { id } = await params;

  const [
    { data: property, error: propertyError },
    { data: keys, error: keysError },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, property_code, address_line_1")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("keys")
      .select(
        "id, key_code, name, key_type, status, storage_location, holder_name"
      )
      .eq("property_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (propertyError || !property) {
    return notFound();
  }

  if (keysError) {
    return (
      <main className="space-y-6">
        <PageHeader
          title="Property Keys"
          subtitle="We could not load the keys for this property."
          actions={
            <Button asChild variant="ghost">
              <Link href={`/properties/${id}`}>Back to Property</Link>
            </Button>
          }
        />
        <SectionCard
          title="Loading Error"
          description={keysError.message}
        >
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link href={`/properties/${id}`}>Return to Property</Link>
            </Button>
            <Button asChild>
              <Link href={`/properties/${id}/keys/new`}>Add Key</Link>
            </Button>
          </div>
        </SectionCard>
      </main>
    );
  }

  const trackedCount = keys?.length || 0;
  const availableCount =
    keys?.filter((key) => key.status === "available").length || 0;
  const assignedCount =
    keys?.filter((key) => key.status === "assigned").length || 0;
  const issueCount =
    keys?.filter((key) => key.status === "lost" || key.status === "damaged")
      .length || 0;

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Keys for ${property.title || "Untitled Property"}`}
        subtitle={`${property.property_code || "-"} • ${property.address_line_1 || "No address"}`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href={`/properties/${id}`}>Back to Property</Link>
            </Button>
            <Button asChild>
              <Link href={`/properties/${id}/keys/new`}>Add Key</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Tracked Keys" value={trackedCount} />
        <StatCard title="Available" value={availableCount} />
        <StatCard title="Assigned" value={assignedCount} />
        <StatCard title="Needs Attention" value={issueCount} />
      </div>

      {!keys || keys.length === 0 ? (
        <EmptyState
          title="No keys registered yet"
          description="Add the first tagged key or key bundle for this property."
          action={
            <Button asChild>
              <Link href={`/properties/${id}/keys/new`}>Add First Key</Link>
            </Button>
          }
        />
      ) : (
        <SectionCard
          title="Property Keys"
          description="Track where each key belongs, where it is stored, and who currently holds it."
          contentClassName="p-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">
                    {key.name || "Unnamed Key"}
                  </TableCell>
                  <TableCell>{key.key_code || "No code"}</TableCell>
                  <TableCell>{key.key_type || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={key.status || "unknown"} />
                  </TableCell>
                  <TableCell>{key.storage_location || "-"}</TableCell>
                  <TableCell>{key.holder_name || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost">
                      <Link href={`/keys/${key.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </main>
  );
}
