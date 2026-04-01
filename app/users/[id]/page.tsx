import { getUserById } from '@/lib/actions/users'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { notFound } from 'next/navigation'
import {
  Mail,
  Phone,
  Shield,
  FileText,
  Calendar,
  CircleCheck,
  CircleX,
} from 'lucide-react'

interface UserDetailPageProps {
  params: { id: string }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function getRoleBadgeVariant(roleName: string): BadgeVariant {
  if (roleName === 'Owner') return 'default'
  if (roleName === 'Auditor') return 'secondary'
  return 'outline'
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { data: user, error } = await getUserById(params.id)

  if (error || !user) notFound()

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title={user.full_name}
        description={user.email}
        icon={
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-700 font-semibold text-xs">{initials}</span>
          </div>
        }
        backHref="/users"
        action={
          <div className="flex items-center gap-2">
            {user.is_active ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <CircleCheck className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="destructive">
                <CircleX className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
            {user.roles && (
              <Badge variant={getRoleBadgeVariant(user.roles.name)}>
                <Shield className="w-3 h-3 mr-1" />
                {user.roles.name}
              </Badge>
            )}
          </div>
        }
      />

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">

        {/* Contact */}
        <div className="px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Contact
          </h2>
          <dl className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 w-20">Email</dt>
              <dd className="text-sm text-gray-900">{user.email}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 w-20">Phone</dt>
              <dd className="text-sm text-gray-900">{user.phone || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Role */}
        <div className="px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Access
          </h2>
          <dl className="space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 w-20">Role</dt>
              <dd className="text-sm text-gray-900">
                {user.roles ? (
                  <span>
                    {user.roles.name}
                    {user.roles.description && (
                      <span className="ml-1.5 text-gray-400">
                        — {user.roles.description}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">No role assigned</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Notes */}
        {user.notes && (
          <div className="px-5 py-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Notes
            </h2>
            <div className="flex gap-3">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{user.notes}</p>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Timeline
          </h2>
          <dl className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 w-20">Created</dt>
              <dd className="text-sm text-gray-900">{formatDate(user.created_at)}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 w-20">Updated</dt>
              <dd className="text-sm text-gray-900">{formatDate(user.updated_at)}</dd>
            </div>
          </dl>
        </div>

      </div>
    </div>
  )
}
