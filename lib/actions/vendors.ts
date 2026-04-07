"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { vendorSchema } from "@/lib/validations/vendor";

export type VendorActionState = {
  error?: string;
};

function formDataToInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    contact_person: String(formData.get("contact_person") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    is_active: String(formData.get("is_active") ?? "true") === "true",
  };
}

export async function createVendorAction(
  _prevState: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  await requireRole(["admin", "office"]);

  const parsed = vendorSchema.safeParse(formDataToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vendor data." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("vendors").insert({
    name: parsed.data.name,
    contact_person: parsed.data.contact_person ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
    notes: parsed.data.notes ?? null,
    is_active: parsed.data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A vendor with this name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/vendors");
  redirect("/settings/vendors");
}

export async function updateVendorAction(
  _prevState: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  await requireRole(["admin", "office"]);

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing vendor id." };

  const parsed = vendorSchema.safeParse(formDataToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vendor data." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("vendors")
    .update({
      name: parsed.data.name,
      contact_person: parsed.data.contact_person ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
      is_active: parsed.data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A vendor with this name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/vendors");
  revalidatePath(`/settings/vendors/${id}/edit`);
  revalidatePath("/expenses");
  redirect("/settings/vendors");
}

export async function toggleVendorActiveAction(formData: FormData) {
  await requireRole(["admin", "office"]);

  const id = String(formData.get("id") ?? "");
  const nextIsActive = String(formData.get("next_is_active") ?? "") === "true";

  if (!id) {
    throw new Error("Missing vendor id.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("vendors")
    .update({
      is_active: nextIsActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/vendors");
  revalidatePath("/expenses");
}