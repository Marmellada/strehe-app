import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  TableShell,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

function maskIban(value: string | null) {
  if (!value) return "Not set";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)} •••• •••• ${value.slice(-4)}`;
}

export default async function BankingSettingsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: accounts, error } = await supabase
    .from("company_bank_accounts")
    .select("id, account_type, bank_id, account_name, bank_name_snapshot, iban, swift, is_primary, is_active, show_on_invoice")
    .order("is_primary", { ascending: false })
    .order("is_active", { ascending: false })
    .order("account_name");

  if (error) {
    throw new Error(error.message);
  }

  const { data: banks, error: banksError } = await supabase
    .from("banks")
    .select("id, name, swift_code, country, is_active")
    .order("is_active", { ascending: false })
    .order("name");

  if (banksError) {
    throw new Error(banksError.message);
  }

  const totalAccounts = accounts?.filter((account) => account.is_active).length ?? 0;
  const cashAccounts = accounts?.filter((account) => account.account_type === "cash").length ?? 0;
  const primaryAccounts = accounts?.filter((account) => account.is_primary).length ?? 0;
  const visibleOnInvoices = accounts?.filter((account) => account.show_on_invoice).length ?? 0;
  const inactiveAccounts = accounts?.filter((account) => !account.is_active).length ?? 0;
  const totalBanks = banks?.length ?? 0;
  const activeBanks = banks?.filter((bank) => bank.is_active).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banking"
        description="Manage company bank and cash accounts plus the licensed-bank registry used for validation and autofill."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/settings/banking/detection">Detection Lab</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/banking/banks/new">Add Licensed Bank</Link>
            </Button>
            <Button asChild>
              <Link href="/settings/banking/new">Add Account</Link>
            </Button>
          </>
        }
      />

      <Alert variant="info">
        <AlertTitle>Billing snapshot note</AlertTitle>
        <AlertDescription>
          Changes made here affect future invoices. Historical invoices keep their own
          bank account snapshot once created.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-7">
        <StatCard title="Active Accounts" value={totalAccounts} />
        <StatCard title="Cash Accounts" value={cashAccounts} />
        <StatCard title="Primary Accounts" value={primaryAccounts} />
        <StatCard title="Shown On Invoices" value={visibleOnInvoices} />
        <StatCard title="Inactive Accounts" value={inactiveAccounts} />
        <StatCard title="Licensed Banks" value={totalBanks} />
        <StatCard title="Active Banks" value={activeBanks} />
      </div>

      <SectionCard
        title="Company Accounts"
        description="These are STREHË's own bank and cash accounts used for invoice payment instructions and payment tracking."
      >
        {accounts && accounts.length > 0 ? (
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Display Bank</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>SWIFT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Badge variant={account.account_type === "cash" ? "warning" : "info"}>
                        {account.account_type === "cash" ? "Cash" : "Bank"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {account.bank_name_snapshot || (account.account_type === "cash" ? "Cash" : "Unnamed Bank")}
                    </TableCell>
                    <TableCell>{account.account_name || "Not set"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {account.account_type === "cash" ? "—" : maskIban(account.iban)}
                    </TableCell>
                    <TableCell>{account.account_type === "cash" ? "—" : account.swift || "Not set"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={account.is_active ? "active" : "inactive"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {account.is_primary ? <Badge>Primary</Badge> : null}
                        {account.show_on_invoice ? (
                          <Badge variant="info">Invoice Visible</Badge>
                        ) : (
                          <Badge variant="neutral">Hidden On Invoice</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/settings/banking/${account.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        ) : (
          <EmptyState
            title="No company bank accounts yet"
            description="Add at least one company bank account before relying on invoice payment details."
            action={
              <Button asChild>
                <Link href="/settings/banking/new">Add First Account</Link>
              </Button>
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Licensed Banks Registry"
        description="This reference registry will power future validation, autofill, and bank detection across the app."
      >
        {banks && banks.length > 0 ? (
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>SWIFT</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{bank.name}</TableCell>
                    <TableCell>{bank.swift_code || "Not set"}</TableCell>
                    <TableCell>{bank.country || "Kosovo"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={bank.is_active ? "active" : "inactive"}
                      />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/settings/banking/banks/${bank.id}`}>
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        ) : (
          <EmptyState
            title="No licensed banks in the registry"
            description="Add the Kosovo licensed banks here before using the registry for validation and autofill."
            action={
              <Button asChild>
                <Link href="/settings/banking/banks/new">Add Licensed Bank</Link>
              </Button>
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
