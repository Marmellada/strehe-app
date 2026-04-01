import { getRoles } from '@/lib/actions/users'
import { CreateUserForm } from '@/components/users/CreateUserForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { UserPlus } from 'lucide-react'

export default async function CreateUserPage() {
  const { data: roles } = await getRoles()

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Add User"
        description="Create a new team member account"
        icon={<UserPlus className="w-6 h-6" />}
        backHref="/users"
      />
      <CreateUserForm roles={roles || []} />
    </div>
  )
}
