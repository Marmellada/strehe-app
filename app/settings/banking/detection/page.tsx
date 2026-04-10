import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type {
  BankIdentifierRule,
  BankIdentifierRuleWithBank,
  BankRegistryBank,
} from "@/types/banking";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { BankDetectionPlayground } from "@/components/banking/BankDetectionPlayground";
import { StatCard } from "@/components/ui/StatCard";
import {
  TableShell,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";

type RawBankIdentifierQueryClient = {
  from: (table: string) => {
    select: (columns: string) => Promise<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
};

export default async function BankingDetectionPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: banks, error: banksError } = await supabase
    .from("banks")
    .select("id, name, swift_code, country, is_active")
    .order("name");

  if (banksError) {
    throw new Error(banksError.message);
  }

  let identifiers: BankIdentifierRule[] = [];
  let identifierRows: BankIdentifierRuleWithBank[] = [];
  let identifierSourceMessage: string | null = null;

  const rawClient = supabase as unknown as RawBankIdentifierQueryClient;

  const identifierQuery = await rawClient
    .from("bank_identifiers")
    .select(
      "id, bank_id, identifier_type, value, value_end, scheme, country_code, priority, is_active, source, notes"
    );

  if (identifierQuery.error) {
    identifierSourceMessage =
      "The bank_identifiers table is not available yet in this environment. Validation and classification already work, but bank matching will stay limited until the migration is applied and rules are seeded.";
  } else {
    identifiers = (identifierQuery.data || []) as BankIdentifierRule[];
    identifierRows = identifiers.map((rule) => ({
      ...rule,
      bank:
        ((banks || []) as BankRegistryBank[]).find((bank) => bank.id === rule.bank_id) ||
        null,
    }));
  }

  const ibanRuleCount = identifierRows.filter(
    (rule) => rule.identifier_type === "iban_prefix" && (rule.is_active ?? true)
  ).length;
  const accountRuleCount = identifierRows.filter(
    (rule) => rule.identifier_type === "account_prefix" && (rule.is_active ?? true)
  ).length;
  const cardRuleCount = identifierRows.filter(
    (rule) => rule.identifier_type === "card_bin" && (rule.is_active ?? true)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Detection Lab"
        description="Internal playground for IBAN, account number, and card detection before connecting banking to clients or vendors."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/settings/banking/detection/new">Add Rule</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/banking">Back to Banking</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Rules" value={identifierRows.length} />
        <StatCard title="IBAN Rules" value={ibanRuleCount} />
        <StatCard title="Account Rules" value={accountRuleCount} />
        <StatCard title="Card BIN Rules" value={cardRuleCount} />
      </div>

      <BankDetectionPlayground
        banks={(banks || []) as BankRegistryBank[]}
        identifiers={identifiers}
        identifierSourceMessage={identifierSourceMessage}
      />

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Scheme</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {identifierRows.length > 0 ? (
              identifierRows.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {rule.bank?.name || "Unknown Bank"}
                  </TableCell>
                  <TableCell>{rule.identifier_type}</TableCell>
                  <TableCell>
                    {rule.value_end ? `${rule.value} - ${rule.value_end}` : rule.value}
                  </TableCell>
                  <TableCell>{rule.scheme || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={rule.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>{rule.source || "-"}</TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/banking/detection/${rule.id}`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground">
                  No detection rules have been added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
