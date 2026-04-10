import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  deactivateLicensedBank,
  updateLicensedBank,
} from "@/lib/actions/banking";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { BankRegistryForm } from "@/components/banking/BankRegistryForm";

export default async function EditLicensedBankPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: bank } = await supabase
    .from("banks")
    .select("id, name, country, swift_code, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!bank) {
    notFound();
  }

  const updateAction = updateLicensedBank.bind(null, id);

  async function deactivateCurrentBank() {
    "use server";

    await deactivateLicensedBank(id);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit Licensed Bank"
        description="Maintain reference metadata used by company accounts and future detection rules."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/banking">Back to Banking</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Registry Details</CardTitle>
          <CardDescription>
            Keep the licensed-bank registry clean and consistent before wiring it to automation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankRegistryForm
            action={updateAction}
            initialValues={bank}
            submitLabel="Save Bank"
          />
        </CardContent>
      </Card>

      {bank.is_active ? (
        <Card>
          <CardHeader>
            <CardTitle>Deactivate Bank</CardTitle>
            <CardDescription>
              Deactivate this bank if it should no longer be selectable in company banking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deactivateCurrentBank}>
              <Button type="submit" variant="destructive">
                Deactivate Bank
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="warning">
          <AlertTitle>Inactive bank</AlertTitle>
          <AlertDescription>
            This licensed bank is already inactive in the registry.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
