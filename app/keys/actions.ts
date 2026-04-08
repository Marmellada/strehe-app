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
  performed_by_user_id: string | null;
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
      performed_by_user_id
    `
    )
    .eq("key_id", keyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getKeyLogs error:", error.message);
    return [];
  }

  const rows = data || [];
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => row.performed_by_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let userMap = new Map<
    string,
    { full_name: string | null; role: string | null }
  >();

  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("app_users")
      .select("id, full_name, role")
      .in("id", userIds);

    if (!usersError) {
      userMap = new Map(
        ((users || []) as Array<{
          id: string;
          full_name: string | null;
          role: string | null;
        }>).map((user) => [user.id, user])
      );
    }
  }

  return rows.map((row) => {
    return {
      id: row.id,
      action: row.action,
      notes: row.notes,
      from_status: row.from_status,
      to_status: row.to_status,
      created_at: row.created_at,
      user_name: row.user_name,
      performed_by_user_id: row.performed_by_user_id,
      performed_by_user: row.performed_by_user_id
        ? userMap.get(row.performed_by_user_id) || null
        : null,
    };
  });
}
