// lib/key-log.ts
import { supabase } from "@/lib/supabase";

export type KeyLog = {
  id: string;
  action: string | null;
  notes: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string | null;
  user_name: string | null;
  performed_by_user: {
    full_name: string | null;
    role: string | null;
  } | null;
};

export async function getKeyLogs(keyId: string): Promise<KeyLog[]> {
  const { data, error } = await supabase
    .from("key_logs")
    .select(
      `
      id,
      action,
      notes,
      from_status,
      to_status,
      created_at,
      user_name,
      performed_by_user:users!key_logs_performed_by_user_fk (
        full_name,
        role
      )
    `
    )
    .eq("key_id", keyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getKeyLogs error:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const raw = row.performed_by_user;
    const performed_by_user = Array.isArray(raw)
      ? (raw[0] ?? null)
      : (raw ?? null);

    return {
      id: row.id,
      action: row.action,
      notes: row.notes,
      from_status: row.from_status,
      to_status: row.to_status,
      created_at: row.created_at,
      user_name: row.user_name,
      performed_by_user: performed_by_user as {
        full_name: string | null;
        role: string | null;
      } | null,
    };
  });
}
