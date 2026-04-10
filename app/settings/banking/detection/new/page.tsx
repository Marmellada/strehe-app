import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { createBankIdentifier } from "@/lib/actions/banking";
import type { BankRegistryBank } from "@/types/banking";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { BankIdentifierRuleForm } from "@/components/banking/BankIdentifierRuleForm";

export default async function NewBankIdentifierPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: banks, error } = await supabase
    .from("banks")
    .select("id, name, swift_code, country, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Detection Rule"
        description="Add a verified banking identifier rule for IBAN, account, or card matching."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/banking/detection">Back to Detection Lab</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Detection Rule</CardTitle>
          <CardDescription>
            Only enter rules you can verify. Avoid guessing bank prefixes or card ranges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankIdentifierRuleForm
            action={createBankIdentifier}
            banks={(banks || []) as BankRegistryBank[]}
            submitLabel="Add Rule"
          />
        </CardContent>
      </Card>
    </div>
  );
}
