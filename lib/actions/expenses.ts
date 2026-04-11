"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import {
  expenseSchema,
  parseAmountToCents,
  type ExpenseInput,
} from "@/lib/validations/expense";

export type ExpenseActionState = {
  error?: string;
};

function formDataToInput(formData: FormData) {
  return {
    expense_date: String(formData.get("expense_date") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    description: String(formData.get("description") ?? ""),
    expense_category_id: String(formData.get("expense_category_id") ?? ""),
    worker_id: String(formData.get("worker_id") ?? ""),
    vendor_id: String(formData.get("vendor_id") ?? ""),
    property_id: String(formData.get("property_id") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

async function loadExpenseRelations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parsed: ExpenseInput,
  options?: {
    allowInactiveCategory?: boolean;
  },
) {
  const { data: category, error: categoryError } = await supabase
    .from("expense_categories")
    .select("id, is_active, name")
    .eq("id", parsed.expense_category_id)
    .single();

  if (categoryError || !category) {
    throw new Error("Selected category was not found.");
  }

  if (!category.is_active && !options?.allowInactiveCategory) {
    return {
      error: "Selected category is inactive and cannot be used for new expenses.",
    } as const;
  }

  let worker:
    | {
        id: string;
        full_name: string | null;
        role_title: string | null;
      }
    | null = null;
  if (parsed.worker_id) {
    const { data: workerData, error: workerError } = await supabase
      .from("workers")
      .select("id, full_name, role_title")
      .eq("id", parsed.worker_id)
      .single();

    if (workerError || !workerData) {
      throw new Error("Selected worker was not found.");
    }

    worker = workerData;
  }

  let vendor:
    | {
        id: string;
        name: string;
      }
    | null = null;
  if (parsed.vendor_id) {
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("id", parsed.vendor_id)
      .single();

    if (vendorError || !vendorData) {
      throw new Error("Selected vendor was not found.");
    }

    vendor = vendorData;
  }

  let property:
    | {
        id: string;
        property_code: string | null;
      }
    | null = null;
  if (parsed.property_id) {
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id, property_code")
      .eq("id", parsed.property_id)
      .single();

    if (propertyError || !propertyData) {
      throw new Error("Selected property was not found.");
    }

    property = propertyData;
  }

  return {
    category,
    worker,
    vendor,
    property,
  } as const;
}

export async function createExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  await requireRole(["admin", "office"]);
  const current = await getCurrentUserWithRole();
  if (!current) {
    return { error: "You must be signed in to create expenses." };
  }

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
  const user = current.authUser;
  const relations = await loadExpenseRelations(supabase, parsed.data);
  if ("error" in relations) {
    return { error: relations.error };
  }

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert({
      expense_date: parsed.data.expense_date,
      amount_cents: amountCents,
      description: parsed.data.description,
      expense_category_id: parsed.data.expense_category_id,
      worker_id: parsed.data.worker_id ?? null,
      vendor_id: parsed.data.vendor_id ?? null,
      property_id: parsed.data.property_id ?? null,
      notes: parsed.data.notes ?? null,
      created_by_user_id: user.id,
      created_by_user_name_snapshot: user.email ?? user.id,
      worker_name_snapshot: relations.worker?.full_name ?? null,
      worker_role_title_snapshot: relations.worker?.role_title ?? null,
      vendor_name_snapshot: relations.vendor?.name ?? null,
      category_name_snapshot: relations.category.name,
      property_code_snapshot: relations.property?.property_code ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to create expense." };
  }

  revalidatePath("/expenses");
  redirect(`/expenses/${inserted.id}`);
}

export async function updateExpenseAction(
  expenseId: string,
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  await requireRole(["admin", "office"]);

  if (!expenseId) {
    return { error: "Expense id is required." };
  }

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
  const { data: existingExpense, error: existingExpenseError } = await supabase
    .from("expenses")
    .select("id, expense_category_id")
    .eq("id", expenseId)
    .single();

  if (existingExpenseError || !existingExpense) {
    return { error: "Expense was not found." };
  }

  const relations = await loadExpenseRelations(supabase, parsed.data, {
    allowInactiveCategory:
      existingExpense.expense_category_id === parsed.data.expense_category_id,
  });
  if ("error" in relations) {
    return { error: relations.error };
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      expense_date: parsed.data.expense_date,
      amount_cents: amountCents,
      description: parsed.data.description,
      expense_category_id: parsed.data.expense_category_id,
      worker_id: parsed.data.worker_id ?? null,
      vendor_id: parsed.data.vendor_id ?? null,
      property_id: parsed.data.property_id ?? null,
      notes: parsed.data.notes ?? null,
      worker_name_snapshot: relations.worker?.full_name ?? null,
      worker_role_title_snapshot: relations.worker?.role_title ?? null,
      vendor_name_snapshot: relations.vendor?.name ?? null,
      category_name_snapshot: relations.category.name,
      property_code_snapshot: relations.property?.property_code ?? null,
    })
    .eq("id", expenseId);

  if (error) {
    return { error: error.message || "Failed to update expense." };
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath(`/expenses/${expenseId}/edit`);
  redirect(`/expenses/${expenseId}`);
}
