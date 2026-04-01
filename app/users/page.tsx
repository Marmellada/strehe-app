import { getUsers } from '@/lib/actions/users'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Users, UserPlus, Mail, Phone, Shield } from 'lucide-react'
import Link from 'next/link'

export default async function UsersPage() {
  const { data: users, error } = await getUsers()

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Failed to load users: {error}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and their access"
        icon={<Users className="w-6 h-6" />}
        action={
          <Link href="/users/create">
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </Link>
        }
      />

      {!users || users.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No users yet"
          description="Add your first team member to get started"
          action={
            <Link href="/users/create">
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/users/${user.id}`}
              className="block"
            >
              <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between">
                  
                  {/* Left: Avatar + Info */}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-semibold text-sm">
                        {user.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>

                    {/* Name + Meta */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {user.full_name}
                        </h3>
                        {!user.is_active && (
                          <Badge variant="red">Inactive</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Role Badge */}
                  <div className="flex items-center gap-2">
                    {user.roles ? (
                      <Badge
                        variant={
                          user.roles.name === 'Owner'
                            ? 'blue'
                            : user.roles.name === 'Auditor'
                            ? 'yellow'
                            : 'gray'
                        }
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {user.roles.name}
                      </Badge>
                    ) : (
                      <Badge variant="gray">No Role</Badge>
                    )}
                  </div>

                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
