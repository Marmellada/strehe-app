import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TaskRow = {
  id: string;
  title: string | null;
  assigned_user_id: string | null;
  status: string | null;
};

function sanitizeFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";

  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeBase || "file"}${ext}`;
}

function isAllowedImageType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(
    mimeType
  );
}

async function submitTaskReport(formData: FormData) {
  "use server";

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const supabase = await createClient();

  const taskId = String(formData.get("taskId") || "").trim();
  const reportType = String(formData.get("report_type") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!taskId) {
    throw new Error("Task ID is missing.");
  }

  if (!reportType) {
    throw new Error("Report type is required.");
  }

  const allowedReportTypes = ["update", "visit", "issue", "completion"];
  if (!allowedReportTypes.includes(reportType)) {
    throw new Error("Invalid report type.");
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, assigned_user_id, status")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    throw new Error("Task not found.");
  }

  const typedTask = task as TaskRow;

  const canSubmit =
    appUser.role === "admin" ||
    appUser.role === "office" ||
    typedTask.assigned_user_id === authUser.id;

  if (!canSubmit) {
    throw new Error("You are not allowed to submit a report for this task.");
  }

  if (typedTask.status === "completed" || typedTask.status === "cancelled") {
    throw new Error("Closed tasks cannot receive new reports. Reopen first.");
  }

  const statusAtSubmission =
    reportType === "completion" ? "completed" : typedTask.status || null;

  const { data: report, error: reportError } = await supabase
    .from("task_reports")
    .insert({
      task_id: taskId,
      created_by_user_id: authUser.id,
      report_type: reportType,
      notes: notes || null,
      status_at_submission: statusAtSubmission,
    })
    .select("id")
    .single();

  if (reportError || !report) {
    throw new Error(
      `Failed to create task report: ${reportError?.message || "Unknown error"}`
    );
  }

  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > 10) {
    throw new Error("You can upload up to 10 photos.");
  }

  for (const file of files) {
    if (!isAllowedImageType(file.type)) {
      throw new Error(
        `Unsupported file type for ${file.name}. Only JPG, PNG, and WEBP are allowed.`
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File ${file.name} exceeds the 10 MB limit.`);
    }
  }

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const safeName = sanitizeFileName(file.name);
    const uniquePrefix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const storagePath = `tasks/${taskId}/${report.id}/${uniquePrefix}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("task-attachments")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    const { error: attachmentError } = await supabase
      .from("task_attachments")
      .insert({
        task_id: taskId,
        task_report_id: report.id,
        uploaded_by_user_id: authUser.id,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size_bytes: file.size || null,
      });

    if (attachmentError) {
      throw new Error(
        `Failed to save attachment metadata for ${file.name}: ${attachmentError.message}`
      );
    }
  }

  if (reportType === "completion") {
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        blocked_reason: null,
        cancelled_reason: null,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", taskId);

    if (updateError) {
      throw new Error(`Failed to auto-complete task: ${updateError.message}`);
    }
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export default async function TaskReportPage({ params }: PageProps) {
  const { id } = await params;

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_user_id, status")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      notFound();
    }

    throw new Error(`Failed to load task: ${error.message}`);
  }

  if (!task) {
    notFound();
  }

  const typedTask = task as TaskRow;

  const canSubmit =
    appUser.role === "admin" ||
    appUser.role === "office" ||
    typedTask.assigned_user_id === authUser.id;

  if (!canSubmit) {
    notFound();
  }

  if (typedTask.status === "completed" || typedTask.status === "cancelled") {
    redirect(`/tasks/${typedTask.id}`);
  }

  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Task Report"
        description={`Submit an operational update, visit note, issue report, or completion report. Task: ${typedTask.title || typedTask.id}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/tasks/${typedTask.id}`}>Back to Task</Link>
          </Button>
        }
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
          <CardDescription>
            Add notes and optional photos. Completion reports automatically finish the task.
          </CardDescription>
        </CardHeader>
        <CardContent>
        <form action={submitTaskReport} className="space-y-6">
          <input type="hidden" name="taskId" value={typedTask.id} />

          <FormField label="Report Type" required>
            <select
              id="report_type"
              name="report_type"
              className={nativeSelectClassName}
              defaultValue="update"
              required
            >
              <option value="update">Update</option>
              <option value="visit">Visit</option>
              <option value="issue">Issue</option>
              <option value="completion">Completion (finishes task)</option>
            </select>
          </FormField>

          <FormField label="Notes">
            <Textarea
              id="notes"
              name="notes"
              rows={8}
              placeholder="Write the report details here..."
            />
          </FormField>

          <FormField
            label="Photos"
            hint="Up to 10 images. Allowed: JPG, PNG, WEBP. Max 10 MB each."
          >
            <Input
              id="photos"
              name="photos"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button asChild variant="outline">
              <Link href={`/tasks/${typedTask.id}`}>Cancel</Link>
            </Button>

            <Button type="submit">Submit Report</Button>
          </div>
        </form>
        </CardContent>
      </Card>
    </div>
  );
}
