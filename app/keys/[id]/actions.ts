// app/keys/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { createKeyLog } from "@/lib/key-log";

// ── Assign ────────────────────────────────────────────────────────────────────
export async function assignKey(formData: FormData) {
  const key_id          = formData.get("key_id") as string;
  const holder_user_id  = formData.get("holder_user_id") as string;
  const notes           = formData.get("notes") as string | null;

  if (!key_id || !holder_user_id) return;

  // Get current status for the log
  const { data: key } = await supabase
    .from("keys")
    .select("status")
    .eq("id", key_id)
    .single();

  await supabase
    .from("keys")
    .update({
      status:               "assigned",
      holder_user_id,
      last_checked_out_at:  new Date().toISOString(),
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action:               "assigned",
    performed_by_user_id: holder_user_id,
    notes:                notes || "Key assigned.",
    from_status:          key?.status ?? null,
    to_status:            "assigned",
  });

  revalidatePath(`/keys/${key_id}`);
}

// ── Return ────────────────────────────────────────────────────────────────────
export async function returnKey(formData: FormData) {
  const key_id               = formData.get("key_id") as string;
  const performed_by_user_id = formData.get("performed_by_user_id") as string;
  const notes                = formData.get("notes") as string | null;

  if (!key_id || !performed_by_user_id) return;

  const { data: key } = await supabase
    .from("keys")
    .select("status")
    .eq("id", key_id)
    .single();

  await supabase
    .from("keys")
    .update({
      status:          "available",
      holder_user_id:  null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action:               "returned",
    performed_by_user_id,
    notes:                notes || "Key returned.",
    from_status:          key?.status ?? null,
    to_status:            "available",
  });

  revalidatePath(`/keys/${key_id}`);
}

// ── Mark as Lost ──────────────────────────────────────────────────────────────
export async function markKeyAsLost(formData: FormData) {
  const key_id               = formData.get("key_id") as string;
  const performed_by_user_id = formData.get("performed_by_user_id") as string;
  const notes                = formData.get("notes") as string | null;

  if (!key_id || !performed_by_user_id) return;

  const { data: key } = await supabase
    .from("keys")
    .select("status")
    .eq("id", key_id)
    .single();

  await supabase
    .from("keys")
    .update({
      status:          "lost",
      holder_user_id:  null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action:               "lost",
    performed_by_user_id,
    notes:                notes || "Key marked as lost.",
    from_status:          key?.status ?? null,
    to_status:            "lost",
  });

  revalidatePath(`/keys/${key_id}`);
}

// ── Mark as Damaged ───────────────────────────────────────────────────────────
export async function markKeyAsDamaged(formData: FormData) {
  const key_id               = formData.get("key_id") as string;
  const performed_by_user_id = formData.get("performed_by_user_id") as string;
  const notes                = formData.get("notes") as string | null;

  if (!key_id || !performed_by_user_id) return;

  const { data: key } = await supabase
    .from("keys")
    .select("status")
    .eq("id", key_id)
    .single();

  await supabase
    .from("keys")
    .update({
      status:          "damaged",
      holder_user_id:  null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action:               "damaged",
    performed_by_user_id,
    notes:                notes || "Key marked as damaged.",
    from_status:          key?.status ?? null,
    to_status:            "damaged",
  });

  revalidatePath(`/keys/${key_id}`);
}

// ── Retire ────────────────────────────────────────────────────────────────────
export async function markKeyAsRetired(formData: FormData) {
  const key_id               = formData.get("key_id") as string;
  const performed_by_user_id = formData.get("performed_by_user_id") as string;
  const notes                = formData.get("notes") as string | null;

  if (!key_id || !performed_by_user_id) return;

  const { data: key } = await supabase
    .from("keys")
    .select("status")
    .eq("id", key_id)
    .single();

  await supabase
    .from("keys")
    .update({
      status:          "retired",
      holder_user_id:  null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action:               "retired",
    performed_by_user_id,
    notes:                notes || "Key retired from active use.",
    from_status:          key?.status ?? null,
    to_status:            "retired",
  });

  revalidatePath(`/keys/${key_id}`);
}
