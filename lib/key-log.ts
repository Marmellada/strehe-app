// lib/key-log.ts

import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateKeyLogInput = {
  key_id: string;
  action: string;
  performed_by_user_id: string;       // UUID — replaces user_name
  notes?: string;
  from_status?: string | null;
  to_status?: string | null;
};

export async function createKeyLog(
  input: CreateKeyLogInput,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.from("key_logs").insert([
    {
      key_id:                input.key_id,
      action:                input.action,
      performed_by_user_id:  input.performed_by_user_id,
      notes:                 input.notes || null,
      from_status:           input.from_status ?? null,
      to_status:             input.to_status ?? null,
    },
  ]);

  if (error) {
    throw new Error(`Failed to create key log: ${error.message}`);
  }
}
