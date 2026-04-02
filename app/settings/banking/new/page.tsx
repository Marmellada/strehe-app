import { PageHeader } from '@/components/ui/PageHeader'
import { BankAccountForm } from '@/components/banking/BankAccountForm'
import { createBankAccount } from '@/lib/actions/banking'

export default async function NewBankAccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Bank Account"
        description="Add a new company bank account"
      />
      <BankAccountForm action={createBankAccount} />
    </div>
  )
}
