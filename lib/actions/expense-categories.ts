"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { expenseCategorySchema } from "@/lib/validations/expense-category";

export type ExpenseCategoryActionState = {
  error?: string;
};

function formDataToInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    sort_order: String(formData.get("sort_order") ?? "0"),
    is_active: String(formData.get("is_active") ?? "true") === "true",
  };
}

export async function createExpenseCategoryAction(
  _prevState: ExpenseCategoryActionState,
  formData: FormData,
): Promise<ExpenseCategoryActionState> {
  await requireRole(["admin", "office"]);

  const parsed = expenseCategorySchema.safeParse(formDataToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category data." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("expense_categories").insert({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A category with this name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/expense-categories");
  redirect("/settings/expense-categories");
}

export async function updateExpenseCategoryAction(
  _prevState: ExpenseCategoryActionState,
  formData: FormData,
): Promise<ExpenseCategoryActionState> {
  await requireRole(["admin", "office"]);

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing category id." };

  const parsed = expenseCategorySchema.safeParse(formDataToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category data." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("expense_categories")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A category with this name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/expense-categories");
  revalidatePath(`/settings/expense-categories/${id}/edit`);
  revalidatePath("/expenses");
  redirect("/settings/expense-categories");
}

export async function toggleExpenseCategoryActiveAction(formData: FormData) {
  await requireRole(["admin", "office"]);

  const id = String(formData.get("id") ?? "");
  const nextIsActive = String(formData.get("next_is_active") ?? "") === "true";

  if (!id) {
    throw new Error("Missing category id.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("expense_categories")
    .update({
      is_active: nextIsActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/expense-categories");
  revalidatePath("/expenses");
}