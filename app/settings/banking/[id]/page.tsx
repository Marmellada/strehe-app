import { createClient } from '@/lib/supabase/server'
import { BankAccountForm } from '@/components/banking/BankAccountForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { notFound } from 'next/navigation'

export default async function EditBankAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: banks }, { data: account }] = await Promise.all([
    supabase
      .from('banks')
      .select('id, name, swift_code, country')
      .order('name'),
    supabase
      .from('company_bank_accounts')
      .select('id, bank_id, account_name, iban, is_primary')
      .eq('id', id)
      .eq('is_active', true)
      .single(),
  ])

  if (!account) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Bank Account</h1>
        <p className="text-muted-foreground">
          Update your company bank account information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Modify your company bank account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountForm {...({ banks: banks || [], account } as any)} />
        </CardContent>
      </Card>
    </div>
  )
}
