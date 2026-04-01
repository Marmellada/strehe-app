import { createClient } from "@/lib/supabase/server";

export type UserRole =
  | "owner"
  | "admin"
  | "manager"
  | "staff"
  | "operator"
  | "contractor"
  | "finance"
  | "operations";

export type User = {
  id: string;
  auth_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  password_changed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getActiveUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActiveUsersByRole(role: UserRole): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", role)
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAssignableUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .in("role", ["staff", "contractor", "manager", "operations"])
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function getUserByAuthId(authId: string): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authId)
    .single();
  if (error) return null;
  return data;
}
