import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, PlusCircle, Building2 } from 'lucide-react'
import Link from 'next/link'

type BankAccount = {
  id: string
  account_name: string
  iban: string
  is_primary: boolean
  is_active: boolean
  created_at: string
  bank: {
    id: string
    name: string
    swift_code: string
    country: string
  } | null
}

export default async function BankingSettingsPage() {
  const supabase = await createClient()

  const { data: accounts } = await supabase
    .from('company_bank_accounts')
    .select(`
      id,
      account_name,
      iban,
      is_primary,
      is_active,
      created_at,
      bank:banks (
        id,
        name,
        swift_code,
        country
      )
    `)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .returns<BankAccount[]>()

  const primaryAccount = accounts?.find((acc) => acc.is_primary)
  const secondaryAccounts = accounts?.filter((acc) => !acc.is_primary) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Bank Accounts</h1>
          <p className="text-muted-foreground">
            Manage your company bank accounts for invoicing and payments
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/banking/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Account
          </Link>
        </Button>
      </div>

      {primaryAccount && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Primary Account</h2>
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Default
            </Badge>
          </div>
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>{primaryAccount.account_name}</CardTitle>
                  <CardDescription>
                    {primaryAccount.bank?.name} • {primaryAccount.bank?.swift_code}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/settings/banking/${primaryAccount.id}`}>
                    Edit
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">IBAN:</span>
                  <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                    {primaryAccount.iban}
                  </code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Country:</span>
                  <span>{primaryAccount.bank?.country}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Added:</span>
                  <span>
                    {new Date(primaryAccount.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {secondaryAccounts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Additional Accounts</h2>
          <div className="grid gap-4">
            {secondaryAccounts.map((account) => (
              <Card key={account.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{account.account_name}</CardTitle>
                      <CardDescription>
                        {account.bank?.name} • {account.bank?.swift_code}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/settings/banking/${account.id}`}>
                        Edit
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">IBAN:</span>
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                        {account.iban}
                      </code>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Country:</span>
                      <span>{account.bank?.country}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Added:</span>
                      <span>
                        {new Date(account.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-center text-muted-foreground mb-2">
              No bank accounts configured yet.
            </p>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Add your company bank account to start invoicing clients.
            </p>
            <Button asChild>
              <Link href="/settings/banking/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Your First Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
