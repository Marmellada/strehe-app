"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createUser } from "@/lib/actions/users"
import { Button } from "@/components/ui/Button"
import { FormInput } from "@/components/ui/FormInput"
import { User, Mail, Phone, Lock, FileText, Shield } from "lucide-react"

interface Role {
  id: string
  name: string
  description: string | null
}

interface CreateUserFormProps {
  roles: Role[]
}

export function CreateUserForm({ roles }: CreateUserFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      setIsLoading(false)
      return
    }

   const result = await createUser({
  email: formData.get("email") as string,
  password: formData.get("password") as string,
  full_name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
  phone: formData.get("phone") as string || undefined,
  role_id: formData.get("roleId") as string,
  notes: formData.get("notes") as string || undefined,
})


    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    router.push("/users")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <User className="w-4 h-4" />
            First Name <span className="text-red-500">*</span>
          </label>
          <FormInput name="firstName" placeholder="John" required />
        </div>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <User className="w-4 h-4" />
            Last Name <span className="text-red-500">*</span>
          </label>
          <FormInput name="lastName" placeholder="Doe" required />
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Mail className="w-4 h-4" />
          Email Address <span className="text-red-500">*</span>
        </label>
        <FormInput name="email" type="email" placeholder="john@example.com" required />
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Phone className="w-4 h-4" />
          Phone Number
        </label>
        <FormInput name="phone" type="tel" placeholder="+383 44 000 000" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Lock className="w-4 h-4" />
            Password <span className="text-red-500">*</span>
          </label>
          <FormInput name="password" type="password" placeholder="Min. 8 characters" required />
        </div>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Lock className="w-4 h-4" />
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <FormInput name="confirmPassword" type="password" placeholder="Repeat password" required />
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Shield className="w-4 h-4" />
          Role <span className="text-red-500">*</span>
        </label>
        <select
          name="roleId"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Select a role...</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="w-4 h-4" />
          Notes
        </label>
        <FormInput name="notes" placeholder="Optional notes about this user" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="default" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create User"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
