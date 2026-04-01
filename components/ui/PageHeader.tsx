import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
}

export function PageHeader({ title, description, icon, action, actions, backHref }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-3">
        {/* Back button */}
        {backHref && (
          <Link
            href={backHref}
            className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}

        {/* Icon */}
        {icon && (
          <div className="mt-0.5 text-blue-600">
            {icon}
          </div>
        )}

        {/* Text */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>

      {/* Actions - supports both prop names */}
      {(action || actions) && (
        <div className="flex items-center gap-3">
          {action}
          {actions}
        </div>
      )}
    </div>
  )
}
