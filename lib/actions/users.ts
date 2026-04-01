// lib/actions/users.ts
'use server'

import { createClient } from '@/lib/supabase/server'           // ✅ Fixed path
import { createClient as createAdminClient } from '@supabase/supabase-js' // ✅ Admin client
import { revalidatePath } from 'next/cache'

// =============================================
// ADMIN CLIENT (service role — server only)
// =============================================

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // Never expose this client-side
  )
}

// =============================================
// TYPES
// =============================================

export type User = {
  id: string
  auth_id: string | null
  full_name: string
  email: string
  phone: string | null
  role: string | null
  role_id: string | null
  is_active: boolean
  avatar_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  roles?: {
    id: string
    name: string
    description: string | null
  } | null
}

export type CreateUserInput = {
  full_name: string
  email: string
  phone?: string
  role_id?: string
  notes?: string
  password: string
}

export type UpdateUserInput = {
  full_name?: string
  email?: string
  phone?: string
  role_id?: string
  notes?: string
  is_active?: boolean
}

export type Role = {
  id: string
  name: string
  description: string | null
  is_system: boolean
}

// =============================================
// READ
// =============================================

export async function getUsers(): Promise<{
  data: User[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      roles (
        id,
        name,
        description
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function getUserById(id: string): Promise<{
  data: User | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      roles (
        id,
        name,
        description
      )
    `)
    .eq('id', id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function getRoles(): Promise<{
  data: Role[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

// =============================================
// CREATE
// =============================================

export async function createUser(input: CreateUserInput): Promise<{
  data: User | null
  error: string | null
}> {
  const admin = getAdminClient()       // Admin for auth.admin.createUser
  const supabase = await createClient() // Regular client for DB insert

  // Step 1: Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name,
    },
  })

  if (authError) return { data: null, error: authError.message }
  if (!authData.user) return { data: null, error: 'Failed to create auth user' }

  // Step 2: Insert profile row
  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: authData.user.id,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone || null,
      role_id: input.role_id || null,
      notes: input.notes || null,
    })
    .select(`
      *,
      roles (
        id,
        name,
        description
      )
    `)
    .single()

  if (error) {
    // Rollback: clean up auth user on profile insert failure
    await admin.auth.admin.deleteUser(authData.user.id)
    return { data: null, error: error.message }
  }

  revalidatePath('/users')
  return { data, error: null }
}

// =============================================
// UPDATE
// =============================================

export async function updateUser(id: string, input: UpdateUserInput): Promise<{
  data: User | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      roles (
        id,
        name,
        description
      )
    `)
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/users')
  revalidatePath(`/users/${id}`)
  return { data, error: null }
}

// =============================================
// DEACTIVATE / REACTIVATE
// =============================================

export async function toggleUserStatus(id: string, is_active: boolean): Promise<{
  error: string | null
}> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/users')
  revalidatePath(`/users/${id}`)
  return { error: null }
}

// =============================================
// DELETE
// =============================================

export async function deleteUser(id: string, auth_id: string): Promise<{
  error: string | null
}> {
  const admin = getAdminClient()
  const supabase = await createClient()

  // Delete profile first
  const { error: profileError } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (profileError) return { error: profileError.message }

  // Then delete auth user
  if (auth_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(auth_id)
    if (authError) return { error: authError.message }
  }

  revalidatePath('/users')
  return { error: null }
}
