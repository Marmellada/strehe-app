import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  deactivateBankIdentifier,
  updateBankIdentifier,
} from "@/lib/actions/banking";
import type { BankIdentifierRule, BankRegistryBank } from "@/types/banking";
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
import { BankIdentifierRuleForm } from "@/components/banking/BankIdentifierRuleForm";

type RawIdentifierClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
  };
};

export default async function EditBankIdentifierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: banks, error: banksError } = await supabase
    .from("banks")
    .select("id, name, swift_code, country, is_active")
    .eq("is_active", true)
    .order("name");

  if (banksError) {
    throw new Error(banksError.message);
  }

  const rawClient = supabase as unknown as RawIdentifierClient;
  const identifierQuery = await rawClient
    .from("bank_identifiers")
    .select(
      "id, bank_id, identifier_type, value, value_end, scheme, country_code, priority, is_active, source, notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (identifierQuery.error) {
    throw new Error(identifierQuery.error.message);
  }

  const rule = identifierQuery.data as BankIdentifierRule | null;

  if (!rule) {
    notFound();
  }

  const updateAction = updateBankIdentifier.bind(null, id);

  async function deactivateCurrentRule() {
    "use server";

    await deactivateBankIdentifier(id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Detection Rule"
        description="Maintain only verified matching rules for bank detection."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/banking/detection">Back to Detection Lab</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Rule Details</CardTitle>
          <CardDescription>
            Keep the detection layer trustworthy. If a rule is uncertain, deactivate it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankIdentifierRuleForm
            action={updateAction}
            banks={(banks || []) as BankRegistryBank[]}
            initialValues={rule}
            submitLabel="Save Rule"
          />
        </CardContent>
      </Card>

      {rule.is_active ? (
        <Card>
          <CardHeader>
            <CardTitle>Deactivate Rule</CardTitle>
            <CardDescription>
              Remove this rule from matching without deleting its history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deactivateCurrentRule}>
              <Button type="submit" variant="destructive">
                Deactivate Rule
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="warning">
          <AlertTitle>Inactive rule</AlertTitle>
          <AlertDescription>
            This detection rule is already inactive and will not be used for matching.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
