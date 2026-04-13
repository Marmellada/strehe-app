import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { BankIdentifierRule } from "@/types/banking";
import { PageHeader } from "@/components/ui/PageHeader";
import { BankAccountForm } from "@/components/banking/BankAccountForm";
import { createBankAccount } from "@/lib/actions/banking";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

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

export default async function NewBankAccountPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const rawClient = supabase as unknown as RawBankIdentifierQueryClient;

  const [{ data: banks, error }, { data: identifiersData }] = await Promise.all([
    supabase
      .from("banks")
      .select("id, name, swift_code, country")
      .eq("is_active", true)
      .order("name"),
    rawClient
      .from("bank_identifiers")
      .select(
        "id, bank_id, identifier_type, value, value_end, scheme, country_code, priority, is_active, source, notes"
      )
      .eq("is_active", true),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Company Account"
        description="Add a company bank account or a cash account for payment handling."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/banking">Back to Banking</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>New Company Account</CardTitle>
          <CardDescription>
            Use bank accounts for invoice payment instructions and cash accounts for petty cash or cash-box tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountForm
            action={createBankAccount}
            banks={banks || []}
            identifiers={(identifiersData || []) as BankIdentifierRule[]}
            submitLabel="Add Account"
            cancelHref="/settings/banking"
            successRedirectHref="/settings/banking"
          />
        </CardContent>
      </Card>
    </div>
  );
}
