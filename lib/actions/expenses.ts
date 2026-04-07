"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { expenseSchema, parseAmountToCents } from "@/lib/validations/expense";

export type ExpenseActionState = {
  error?: string;
};

function formDataToInput(formData: FormData) {
  return {
    expense_date: String(formData.get("expense_date") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    description: String(formData.get("description") ?? ""),
    expense_category_id: String(formData.get("expense_category_id") ?? ""),
    vendor_id: String(formData.get("vendor_id") ?? ""),
    property_id: String(formData.get("property_id") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  await requireRole(["admin", "office"]);

  const parsed = expenseSchema.safeParse(formDataToInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid expense data." };
  }

  let amountCents: number;
  try {
    amountCents = parseAmountToCents(parsed.data.amount);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Amount is invalid.",
    };
  }

  const supabase = await createClient();

  const { data: category, error: categoryError } = await supabase
    .from("expense_categories")
    .select("id, is_active")
    .eq("id", parsed.data.expense_category_id)
    .single();

  if (categoryError || !category) {
    return { error: "Selected category was not found." };
  }

  if (!category.is_active) {
    return { error: "Selected category is inactive and cannot be used for new expenses." };
  }

  if (parsed.data.vendor_id) {
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", parsed.data.vendor_id)
      .single();

    if (vendorError || !vendor) {
      return { error: "Selected vendor was not found." };
    }
  }

  if (parsed.data.property_id) {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parsed.data.property_id)
      .single();

    if (propertyError || !property) {
      return { error: "Selected property was not found." };
    }
  }

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert({
      expense_date: parsed.data.expense_date,
      amount_cents: amountCents,
      description: parsed.data.description,
      expense_category_id: parsed.data.expense_category_id,
      vendor_id: parsed.data.vendor_id ?? null,
      property_id: parsed.data.property_id ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to create expense." };
  }

  revalidatePath("/expenses");
  redirect(`/expenses/${inserted.id}`);
}