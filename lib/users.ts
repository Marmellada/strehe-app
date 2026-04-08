import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

export type UserRole = AppRole;

export type User = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

function toUser(row: AppUserRow): User {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/*
 * Phase A.2 quarantine:
 * These helpers keep their old export names for existing callers, but the
 * backing table is the canonical app user table: public.app_users.
 */

export async function getActiveUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(error.message);
  return ((data ?? []) as AppUserRow[]).map(toUser);
}

export async function getAllUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active, created_at, updated_at")
    .order("full_name");

  if (error) throw new Error(error.message);
  return ((data ?? []) as AppUserRow[]).map(toUser);
}

export async function getActiveUsersByRole(role: UserRole): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active, created_at, updated_at")
    .eq("role", role)
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(error.message);
  return ((data ?? []) as AppUserRow[]).map(toUser);
}

export async function getAssignableUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active, created_at, updated_at")
    .in("role", ["office", "field", "contractor"])
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(error.message);
  return ((data ?? []) as AppUserRow[]).map(toUser);
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, is_active, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toUser(data as AppUserRow);
}

export async function getUserByAuthId(authId: string): Promise<User | null> {
  return getUserById(authId);
}
