"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

type AllowedRole = "admin" | "office" | "field" | "contractor";

type TaskActionRow = {
  id: string;
  assigned_user_id: string | null;
  status: string | null;
  subscription_id: string | null;
  blocked_reason: string | null;
  cancelled_reason: string | null;
};

async function loadTaskForAction(taskId: string) {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, assigned_user_id, status, subscription_id, blocked_reason, cancelled_reason")
    .eq("id", taskId)
    .single();

  if (error || !task) {
    throw new Error("Task not found.");
  }

  return { supabase, task: task as TaskActionRow };
}

function canManageAnyTask(role: AllowedRole) {
  return role === "admin" || role === "office";
}

function canManageOwnAssignedTask(role: AllowedRole) {
  return role === "field" || role === "contractor";
}

export async function markTaskInProgress(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const role = appUser.role as AllowedRole;
  const { supabase, task } = await loadTaskForAction(taskId);

  const canManage =
    canManageAnyTask(role) ||
    (canManageOwnAssignedTask(role) && task.assigned_user_id === authUser.id);

  if (!canManage) {
    throw new Error("You are not allowed to update this task.");
  }

  if (task.status === "completed") {
    throw new Error("Completed tasks must be reopened before they can be updated.");
  }

  if (task.status === "cancelled") {
    throw new Error("Cancelled tasks must be reopened before they can be updated.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "in_progress",
      blocked_reason: null,
      cancelled_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function markTaskCompleted(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const role = appUser.role as AllowedRole;
  const { supabase, task } = await loadTaskForAction(taskId);

  const canManage =
    canManageAnyTask(role) ||
    (canManageOwnAssignedTask(role) && task.assigned_user_id === authUser.id);

  if (!canManage) {
    throw new Error("You are not allowed to update this task.");
  }

  if (task.status === "completed") {
    throw new Error("Task is already completed.");
  }

  if (task.status === "cancelled") {
    throw new Error("Cancelled tasks must be reopened before they can be completed.");
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      blocked_reason: null,
      cancelled_reason: null,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to complete task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function reopenTask(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();

  await requireRole(["admin", "office"]);

  const { supabase, task } = await loadTaskForAction(taskId);

  if (!["completed", "cancelled"].includes(task.status || "")) {
    throw new Error("Only completed or cancelled tasks can be reopened.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "open",
      blocked_reason: null,
      cancelled_reason: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to reopen task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function unassignTask(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();

  await requireRole(["admin", "office"]);

  const { supabase, task } = await loadTaskForAction(taskId);

  if (task.status === "completed") {
    throw new Error("Completed tasks cannot be reassigned. Reopen first.");
  }

  if (task.status === "cancelled") {
    throw new Error("Cancelled tasks cannot be reassigned. Reopen first.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_user_id: null,
      assigned_user_name_snapshot: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to unassign task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function assignTaskToMe(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const { supabase, task } = await loadTaskForAction(taskId);

  if (task.status === "completed") {
    throw new Error("Completed tasks cannot be reassigned. Reopen first.");
  }

  if (task.status === "cancelled") {
    throw new Error("Cancelled tasks cannot be reassigned. Reopen first.");
  }

  const canAssign =
    appUser.role === "admin" ||
    appUser.role === "office" ||
    appUser.role === "field" ||
    appUser.role === "contractor";

  if (!canAssign) {
    throw new Error("You are not allowed to assign this task.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_user_id: authUser.id,
      assigned_user_name_snapshot:
        appUser.full_name?.trim() || appUser.email || authUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to assign task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function deleteTask(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();
  const cancelledReason = String(formData.get("cancelled_reason") || "").trim();

  await requireRole(["admin", "office"]);

  const { supabase, task } = await loadTaskForAction(taskId);

  if (task.subscription_id) {
    throw new Error("Auto-generated subscription tasks cannot be cancelled manually.");
  }
  if (task.status === "completed" || task.status === "cancelled") {
    throw new Error("Closed tasks cannot be cancelled again.");
  }
  if (!cancelledReason) {
    throw new Error("Cancelled tasks require a reason.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "cancelled",
      blocked_reason: null,
      cancelled_reason: cancelledReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to cancel task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function blockTask(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();
  const blockedReason = String(formData.get("blocked_reason") || "").trim();

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const role = appUser.role as AllowedRole;
  const { supabase, task } = await loadTaskForAction(taskId);

  const canManage =
    canManageAnyTask(role) ||
    (canManageOwnAssignedTask(role) && task.assigned_user_id === authUser.id);

  if (!canManage) {
    throw new Error("You are not allowed to block this task.");
  }

  if (["completed", "cancelled"].includes(task.status || "")) {
    throw new Error("Closed tasks cannot be blocked.");
  }

  if (!blockedReason) {
    throw new Error("Blocked tasks require a reason.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "blocked",
      blocked_reason: blockedReason,
      cancelled_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to block task: ${error.message}`);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}
