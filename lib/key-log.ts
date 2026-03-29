import { supabase } from "@/lib/supabase";

type CreateKeyLogParams = {
  key_id: string;
  action: "assigned" | "returned" | "lost" | "damaged" | "retired";
  user_name: string;
  notes?: string | null;
  from_status: string | null;
  to_status: string | null;
};

export async function createKeyLog({
  key_id,
  action,
  user_name,
  notes,
  from_status,
  to_status,
}: CreateKeyLogParams) {
  const { error } = await supabase.from("key_logs").insert({
    key_id,
    action,
    user_name,
    notes: notes || null,
    from_status,
    to_status,
  });

  if (error) {
    throw new Error(`Failed to create key log: ${error.message}`);
  }
}