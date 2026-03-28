import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TaskEditForm from "./TaskEditForm";

async function updateTask(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const property_id = String(formData.get("property_id") || "").trim();
  const reported_by_client_id = String(formData.get("reported_by_client_id") || "").trim();
  const assigned_to_client_id = String(formData.get("assigned_to_client_id") || "").trim();
  const service_id = String(formData.get("service_id") || "").trim();
  const subscription_id = String(formData.get("subscription_id") || "").trim();
  const status = String(formData.get("status") || "open").trim();
  const priority = String(formData.get("priority") || "medium").trim();
  const due_date = String(formData.get("due_date") || "").trim();

  if (!id) {
    throw new Error("Missing task id.");
  }

  if (!title || !property_id) {
    throw new Error("Title and property are required.");
  }

  const payload: any = {
    title,
    description: description || null,
    property_id,
    reported_by_client_id: reported_by_client_id || null,
    assigned_to_client_id: assigned_to_client_id || null,
    service_id: service_id || null,
    subscription_id: subscription_id || null,
    status,
    priority,
    due_date: due_date || null,
  };

  if (status === "completed") {
    payload.completed_at = new Date().toISOString();
  } else {
    payload.completed_at = null;
  }

  const { error } = await supabase.from("tasks").update(payload).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/tasks/${id}`);
}

type EditTaskPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTaskPage({
  params,
}: EditTaskPageProps) {
  const { id } = await params;

  const [
    { data: task, error },
    { data: properties },
    { data: clients },
    { data: services },
    { data: subscriptions },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        property_id,
        reported_by_client_id,
        assigned_to_client_id,
        service_id,
        subscription_id,
        status,
        priority,
        due_date
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("properties")
      .select("id, title, property_code")
      .order("title"),

    supabase
      .from("clients")
      .select("id, full_name, company_name")
      .order("full_name"),

    supabase
      .from("services")
      .select(
        "id, name, category, default_title, default_description, default_priority"
      )
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("subscriptions")
      .select(`
        id,
        property_id,
        status,
        client:clients!subscriptions_client_fk (
          full_name,
          company_name
        ),
        property:properties!subscriptions_property_fk (
          title,
          property_code
        ),
        package:packages!subscriptions_package_fk (
          name
        )
      `)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false }),
  ]);

  if (error || !task) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Edit Task</h1>
          <p className="page-subtitle">{task.title || "-"}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/tasks/${task.id}`} className="btn">
            Back to Task
          </Link>
        </div>
      </div>

      <TaskEditForm
        action={updateTask}
        task={task as any}
        properties={(properties || []) as any[]}
        clients={(clients || []) as any[]}
        services={(services || []) as any[]}
        subscriptions={(subscriptions || []) as any[]}
      />
    </div>
  );
}