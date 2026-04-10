import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createLicensedBank } from "@/lib/actions/banking";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { BankRegistryForm } from "@/components/banking/BankRegistryForm";

export default async function NewLicensedBankPage() {
  await requireRole(["admin"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Licensed Bank"
        description="Add a bank to the internal licensed-bank registry used for validation and autofill."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/banking">Back to Banking</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Bank Registry Entry</CardTitle>
          <CardDescription>
            This registry powers future bank detection and normalized bank metadata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankRegistryForm action={createLicensedBank} submitLabel="Add Bank" />
        </CardContent>
      </Card>
    </div>
  );
}
