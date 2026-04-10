"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkersAccess } from "@/lib/auth/require-workers-access";
import { detectBankFromInput } from "@/lib/banking/detection";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value === "" ? null : value;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getNullableNumber(formData: FormData, key: string) {
  const raw = getString(formData, key);
  if (!raw) return null;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${key}`);
  }

  return parsed;
}

function validateRequired(value: string, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
}

function normalizeWorkerPayload(formData: FormData) {
  const full_name = getString(formData, "full_name");
  const personal_id = getNullableString(formData, "personal_id");
  const email = getNullableString(formData, "email");
  const phone = getNullableString(formData, "phone");

  const role_title = getString(formData, "role_title");
  const worker_type = getString(formData, "worker_type");
  const status = getString(formData, "status");
  const start_date = getString(formData, "start_date");
  const end_date = getNullableString(formData, "end_date");

  const base_salary = getNullableNumber(formData, "base_salary");
  const payment_frequency = getNullableString(formData, "payment_frequency");
  const payment_method = getNullableString(formData, "payment_method");
  const bank_account_raw = getNullableString(formData, "bank_account");
  const bank_account = bank_account_raw
    ? bank_account_raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : null;

  const subject_to_tax = getBoolean(formData, "subject_to_tax");
  const subject_to_pension = getBoolean(formData, "subject_to_pension");

  const notes = getNullableString(formData, "notes");

  validateRequired(full_name, "Full name");
  validateRequired(role_title, "Role title");
  validateRequired(worker_type, "Worker type");
  validateRequired(status, "Status");
  validateRequired(start_date, "Start date");

  if (payment_method === "bank" && !bank_account) {
    throw new Error("Bank account is required when payment method is Bank.");
  }

  if (bank_account) {
    const bankDetection = detectBankFromInput({ input: bank_account });

    if (!bankDetection.isValid) {
      throw new Error(bankDetection.validationMessage);
    }

    if (bankDetection.kind === "card_number") {
      throw new Error(
        "Card numbers are not allowed for staff bank details. Please enter an IBAN or bank account number."
      );
    }
  }

  return {
    full_name,
    personal_id,
    email,
    phone,
    role_title,
    worker_type,
    status,
    start_date,
    end_date,
    base_salary,
    payment_frequency,
    payment_method,
    bank_account,
    subject_to_tax,
    subject_to_pension,
    notes,
  };
}

export async function createWorker(formData: FormData) {
  const { supabase } = await requireWorkersAccess();
  const payload = normalizeWorkerPayload(formData);

  const { data, error } = await supabase
    .from("workers")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: historyError } = await supabase
    .from("worker_role_title_history")
    .insert({
      worker_id: data.id,
      role_title: payload.role_title,
      valid_from: payload.start_date,
      valid_to: null,
      change_reason: "Initial worker creation",
    });

  if (historyError) {
    throw new Error(historyError.message);
  }

  revalidatePath("/workers");
  revalidatePath("/workers/new");

  redirect(`/workers/${data.id}`);
}

export async function updateWorker(workerId: string, formData: FormData) {
  const { supabase } = await requireWorkersAccess();
  const payload = normalizeWorkerPayload(formData);
  const currentDate = new Date().toISOString().slice(0, 10);

  const { data: existingWorker, error: existingWorkerError } = await supabase
    .from("workers")
    .select("role_title")
    .eq("id", workerId)
    .single();

  if (existingWorkerError || !existingWorker) {
    throw new Error(existingWorkerError?.message || "Worker not found.");
  }

  const { error } = await supabase
    .from("workers")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId);

  if (error) {
    throw new Error(error.message);
  }

  if (existingWorker.role_title !== payload.role_title) {
    const { error: closeHistoryError } = await supabase
      .from("worker_role_title_history")
      .update({ valid_to: currentDate })
      .eq("worker_id", workerId)
      .is("valid_to", null);

    if (closeHistoryError) {
      throw new Error(closeHistoryError.message);
    }

    const { error: insertHistoryError } = await supabase
      .from("worker_role_title_history")
      .insert({
        worker_id: workerId,
        role_title: payload.role_title,
        valid_from: currentDate,
        valid_to: null,
        change_reason: "Role title updated",
      });

    if (insertHistoryError) {
      throw new Error(insertHistoryError.message);
    }
  }

  revalidatePath("/workers");
  revalidatePath(`/workers/${workerId}`);

  redirect(`/workers/${workerId}`);
}
