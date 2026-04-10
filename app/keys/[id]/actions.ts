// app/keys/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth/require-role";
import { createKeyLog } from "@/lib/key-log";

type KeyActionContext = {
  key_id: string;
  notes: string | null;
  actorId: string;
};

type KeyRecord = {
  status: string | null;
  holder_user_id: string | null;
  holder_name: string | null;
};

async function requireKeysWriteAccess() {
  return requireRole(["admin", "office"]);
}

async function getExistingKey(key_id: string): Promise<KeyRecord> {
  const { data: key, error } = await supabase
    .from("keys")
    .select("status, holder_user_id, holder_name")
    .eq("id", key_id)
    .maybeSingle();

  if (error || !key) {
    throw new Error(error?.message || "Key not found.");
  }

  return key as KeyRecord;
}

async function getHolderSnapshot(holder_user_id: string) {
  const { data: appUser, error } = await supabase
    .from("app_users")
    .select("id, full_name, email, is_active")
    .eq("id", holder_user_id)
    .maybeSingle();

  if (error || !appUser) {
    throw new Error(error?.message || "Selected holder was not found.");
  }

  if (appUser.is_active === false) {
    throw new Error("Selected holder is not active.");
  }

  return {
    holder_user_id: appUser.id as string,
    holder_name:
      (appUser.full_name as string | null)?.trim() ||
      (appUser.email as string | null) ||
      appUser.id,
  };
}

async function getActionContext(formData: FormData): Promise<KeyActionContext> {
  const { authUser } = await requireKeysWriteAccess();
  const key_id = formData.get("key_id") as string;
  const notes = formData.get("notes") as string | null;

  if (!key_id) {
    throw new Error("Missing key id.");
  }

  return {
    key_id,
    notes,
    actorId: authUser.id,
  };
}

// ── Assign ────────────────────────────────────────────────────────────────────
export async function assignKey(formData: FormData) {
  const { key_id, notes, actorId } = await getActionContext(formData);
  const holder_user_id = formData.get("holder_user_id") as string;

  if (!holder_user_id) {
    throw new Error("Select a person to assign the key to.");
  }

  const [key, holder] = await Promise.all([
    getExistingKey(key_id),
    getHolderSnapshot(holder_user_id),
  ]);

  if (key.status !== "available") {
    throw new Error("Only available keys can be assigned.");
  }

  await supabase
    .from("keys")
    .update({
      status: "assigned",
      holder_user_id: holder.holder_user_id,
      holder_name: holder.holder_name,
      last_checked_out_at: new Date().toISOString(),
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action: "assigned",
    performed_by_user_id: actorId,
    notes: notes || `Key assigned to ${holder.holder_name}.`,
    from_status: key.status ?? null,
    to_status: "assigned",
  });

  revalidatePath(`/keys/${key_id}`);
  revalidatePath("/keys");
}

// ── Return ────────────────────────────────────────────────────────────────────
export async function returnKey(formData: FormData) {
  const { key_id, notes, actorId } = await getActionContext(formData);
  const key = await getExistingKey(key_id);

  if (key.status !== "assigned") {
    throw new Error("Only assigned keys can be returned.");
  }

  await supabase
    .from("keys")
    .update({
      status: "available",
      holder_user_id: null,
      holder_name: null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action: "returned",
    performed_by_user_id: actorId,
    notes: notes || "Key returned to storage.",
    from_status: key.status ?? null,
    to_status: "available",
  });

  revalidatePath(`/keys/${key_id}`);
  revalidatePath("/keys");
}

// ── Mark as Lost ──────────────────────────────────────────────────────────────
export async function markKeyAsLost(formData: FormData) {
  const { key_id, notes, actorId } = await getActionContext(formData);
  const key = await getExistingKey(key_id);

  if (key.status !== "available" && key.status !== "assigned") {
    throw new Error("Only available or assigned keys can be marked as lost.");
  }

  await supabase
    .from("keys")
    .update({
      status: "lost",
      holder_user_id: null,
      holder_name: null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action: "lost",
    performed_by_user_id: actorId,
    notes: notes || "Key marked as lost.",
    from_status: key.status ?? null,
    to_status: "lost",
  });

  revalidatePath(`/keys/${key_id}`);
  revalidatePath("/keys");
}

// ── Mark as Damaged ───────────────────────────────────────────────────────────
export async function markKeyAsDamaged(formData: FormData) {
  const { key_id, notes, actorId } = await getActionContext(formData);
  const key = await getExistingKey(key_id);

  if (key.status !== "available" && key.status !== "assigned") {
    throw new Error("Only available or assigned keys can be marked as damaged.");
  }

  await supabase
    .from("keys")
    .update({
      status: "damaged",
      holder_user_id: null,
      holder_name: null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action: "damaged",
    performed_by_user_id: actorId,
    notes: notes || "Key marked as damaged.",
    from_status: key.status ?? null,
    to_status: "damaged",
  });

  revalidatePath(`/keys/${key_id}`);
  revalidatePath("/keys");
}

// ── Retire ────────────────────────────────────────────────────────────────────
export async function markKeyAsRetired(formData: FormData) {
  const { key_id, notes, actorId } = await getActionContext(formData);
  const key = await getExistingKey(key_id);

  if (key.status === "retired") {
    throw new Error("This key is already retired.");
  }

  await supabase
    .from("keys")
    .update({
      status: "retired",
      holder_user_id: null,
      holder_name: null,
    })
    .eq("id", key_id);

  await createKeyLog({
    key_id,
    action: "retired",
    performed_by_user_id: actorId,
    notes: notes || "Key retired from active use.",
    from_status: key.status ?? null,
    to_status: "retired",
  });

  revalidatePath(`/keys/${key_id}`);
  revalidatePath("/keys");
}
