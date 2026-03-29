"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createKeyLog } from "@/lib/key-log";

async function getKeyOrThrow(id: string) {
  const { data, error } = await supabase
    .from("keys")
    .select("id, property_id, status, key_code, holder_name")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Key not found.");
  }

  return data;
}

export async function markKeyAsLost(formData: FormData) {
  const keyId = String(formData.get("key_id") || "").trim();
  const userName = String(formData.get("user_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!keyId) throw new Error("Missing key ID.");
  if (!userName) throw new Error("User name is required.");

  const key = await getKeyOrThrow(keyId);

  if (!["available", "assigned"].includes(key.status)) {
    throw new Error("This key cannot be marked as lost.");
  }

  const fromStatus = key.status;
  const toStatus = "lost";

  const { error } = await supabase
    .from("keys")
    .update({
      status: toStatus,
      holder_name: null,
    })
    .eq("id", keyId);

  if (error) {
    throw new Error(`Failed to mark key as lost: ${error.message}`);
  }

  await createKeyLog({
    key_id: keyId,
    action: "lost",
    user_name: userName,
    notes: notes || "Key marked as lost.",
    from_status: fromStatus,
    to_status: toStatus,
  });

  revalidatePath("/keys");
  revalidatePath(`/keys/${keyId}`);
}

export async function markKeyAsDamaged(formData: FormData) {
  const keyId = String(formData.get("key_id") || "").trim();
  const userName = String(formData.get("user_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!keyId) throw new Error("Missing key ID.");
  if (!userName) throw new Error("User name is required.");

  const key = await getKeyOrThrow(keyId);

  if (!["available", "assigned"].includes(key.status)) {
    throw new Error("This key cannot be marked as damaged.");
  }

  const fromStatus = key.status;
  const toStatus = "damaged";

  const { error } = await supabase
    .from("keys")
    .update({
      status: toStatus,
      holder_name: null,
    })
    .eq("id", keyId);

  if (error) {
    throw new Error(`Failed to mark key as damaged: ${error.message}`);
  }

  await createKeyLog({
    key_id: keyId,
    action: "damaged",
    user_name: userName,
    notes: notes || "Key marked as damaged.",
    from_status: fromStatus,
    to_status: toStatus,
  });

  revalidatePath("/keys");
  revalidatePath(`/keys/${keyId}`);
}

export async function markKeyAsRetired(formData: FormData) {
  const keyId = String(formData.get("key_id") || "").trim();
  const userName = String(formData.get("user_name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!keyId) throw new Error("Missing key ID.");
  if (!userName) throw new Error("User name is required.");

  const key = await getKeyOrThrow(keyId);

  if (key.status === "retired") {
    throw new Error("This key is already retired.");
  }

  const fromStatus = key.status;
  const toStatus = "retired";

  const { error } = await supabase
    .from("keys")
    .update({
      status: toStatus,
      holder_name: null,
    })
    .eq("id", keyId);

  if (error) {
    throw new Error(`Failed to retire key: ${error.message}`);
  }

  await createKeyLog({
    key_id: keyId,
    action: "retired",
    user_name: userName,
    notes: notes || "Key retired from active use.",
    from_status: fromStatus,
    to_status: toStatus,
  });

  revalidatePath("/keys");
  revalidatePath(`/keys/${keyId}`);
}