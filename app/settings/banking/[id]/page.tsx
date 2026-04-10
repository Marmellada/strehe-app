import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { updateBankAccount, deactivateBankAccount } from "@/lib/actions/banking";
import type { BankIdentifierRule } from "@/types/banking";
import { BankAccountForm } from "@/components/banking/BankAccountForm";
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

type BankOption = {
  id: string;
  name: string;
  swift_code: string | null;
  country: string | null;
};

type RawBankIdentifierQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: boolean
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

export default async function EditBankAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const rawClient = supabase as unknown as RawBankIdentifierQueryClient;

  const [{ data: banks }, { data: account }, { data: identifiersData }] = await Promise.all([
    supabase
      .from('banks')
      .select('id, name, swift_code, country')
      .order('name'),
    supabase
      .from('company_bank_accounts')
      .select('id, bank_id, account_name, bank_name_snapshot, iban, swift, is_primary, show_on_invoice')
      .eq('id', id)
      .eq('is_active', true)
      .single(),
    rawClient
      .from("bank_identifiers")
      .select(
        "id, bank_id, identifier_type, value, value_end, scheme, country_code, priority, is_active, source, notes"
      )
      .eq("is_active", true),
  ]);

  if (!account) {
    notFound();
  }

  const updateAction = updateBankAccount.bind(null, id);
  async function deactivateCurrentAccount() {
    "use server";

    await deactivateBankAccount(id);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit Bank Account"
        description="Update the account details used for invoices and payment routing."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/banking">Back to Banking</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Modify the bank, account holder details, invoice visibility, and primary status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountForm
            action={updateAction}
            banks={(banks || []) as BankOption[]}
            identifiers={(identifiersData || []) as BankIdentifierRule[]}
            initialValues={account}
            submitLabel="Save Changes"
            cancelHref="/settings/banking"
            successRedirectHref="/settings/banking"
          />
        </CardContent>
      </Card>

      {account.is_primary ? (
        <Alert variant="warning">
          <AlertTitle>Primary account protection</AlertTitle>
          <AlertDescription>
            This account is currently marked as primary. Assign another account as
            primary before deactivating this one.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Deactivate Account</CardTitle>
            <CardDescription>
              Remove this account from active invoice and payment use without deleting its history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deactivateCurrentAccount}>
              <Button type="submit" variant="destructive">
                Deactivate Account
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
