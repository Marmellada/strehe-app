import { createClient } from "@/lib/supabase/server";

export async function generateTasks() {
  const supabase = await createClient();

  const today = new Date();

  // 1. Get all active subscription task configs
  const { data: configs } = await supabase
    .from("subscription_tasks")
    .select(`
      id,
      subscription_id,
      task_templates (
        id,
        name,
        description,
        tasks_per_month
      )
    `)
    .eq("is_active", true);

  if (!configs) return;

  for (const config of configs) {
    const template = Array.isArray(config.task_templates)
      ? config.task_templates[0]
      : config.task_templates;

    if (!template) continue;

    const tasksPerMonth = template.tasks_per_month || 1;
    const interval = Math.floor(30 / tasksPerMonth);

    for (let i = 0; i < tasksPerMonth; i++) {
      const dueDate = new Date();
      dueDate.setDate(1 + i * interval);

      const generationDate = new Date(dueDate);
      generationDate.setDate(dueDate.getDate() - 10);

      // Only generate if today matches generation date
      if (
        generationDate.toDateString() !== today.toDateString()
      ) {
        continue;
      }

      // Prevent duplicates
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("subscription_id", config.subscription_id)
        .eq("due_date", dueDate.toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("tasks").insert({
        title: template.name,
        description: template.description,
        subscription_id: config.subscription_id,
        due_date: dueDate.toISOString(),
        status: "open",
      });
    }
  }
}