// app/tasks/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteTask(formData: FormData) {
  const taskId = formData.get("taskId") as string;
  if (!taskId) throw new Error("Task ID is required");

  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTaskStatus(
  taskId: string,
  status: string
) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task status: ${error.message}`);
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}
