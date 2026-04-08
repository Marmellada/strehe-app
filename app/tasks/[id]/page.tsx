import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { deleteTask } from "./actions";
import {
  assignTaskToMe,
  markTaskCompleted,
  markTaskInProgress,
  reopenTask,
  unassignTask,
} from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  assigned_user_name_snapshot: string | null;
  created_by_user_id: string | null;
  created_by_user_name_snapshot: string | null;
  reported_by_user_id: string | null;
  reported_by_user_name_snapshot: string | null;
  property_id: string | null;
  property_code_snapshot: string | null;
  subscription_id: string | null;
  subscription_package_name_snapshot: string | null;
  service_id: string | null;
  service_name_snapshot: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type PropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
  address_line_1: string | null;
};

type ServiceRow = {
  id: string;
  name: string | null;
};

type SubscriptionRow = {
  id: string;
  package_name_snapshot: string | null;
  package_id: string | null;
};

type PackageRow = {
  id: string;
  name: string | null;
};

type TaskReportRow = {
  id: string;
  report_type: string | null;
  notes: string | null;
  created_at: string | null;
  created_by_user_id: string | null;
  status_at_submission: string | null;
};

type TaskAttachmentRow = {
  id: string;
  task_report_id: string | null;
  storage_path: string;
  file_name: string | null;
};

type ReportImageRow = {
  id: string;
  file_name: string | null;
  signed_url: string;
};

function formatDate(dateString: string | null) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPersonLabel(user: AppUserRow | null) {
  if (!user) return "—";
  return user.full_name?.trim() || user.email || "Unnamed User";
}

function getRoleLabel(user: AppUserRow | null) {
  if (!user?.role) return null;
  return formatLabel(user.role);
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "blocked":
      return "bg-red-50 text-red-700 border border-red-200";
    case "completed":
      return "bg-green-50 text-green-700 border border-green-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function getPriorityClasses(priority: string | null) {
  switch (priority) {
    case "urgent":
      return "bg-red-50 text-red-700 border border-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 border border-orange-200";
    case "medium":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "low":
      return "bg-gray-50 text-gray-700 border border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

export default async function TaskDetailPage({ params }: PageProps) {
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
    .select(
      `
      id,
      title,
      description,
      status,
      priority,
      due_date,
      assigned_user_id,
      assigned_user_name_snapshot,
      created_by_user_id,
      created_by_user_name_snapshot,
      reported_by_user_id,
      reported_by_user_name_snapshot,
      property_id,
      property_code_snapshot,
      subscription_id,
      subscription_package_name_snapshot,
      service_id,
      service_name_snapshot,
      created_at,
      updated_at,
      completed_at
      `
    )
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
  const isAutoTask = Boolean(typedTask.subscription_id);

  const isRestrictedRole =
    appUser.role === "field" || appUser.role === "contractor";

  const canViewTask =
    !isRestrictedRole || typedTask.assigned_user_id === authUser.id;

  if (!canViewTask) {
    notFound();
  }

  const isCompleted = typedTask.status === "completed";
  const canManageTask = appUser.role === "admin" || appUser.role === "office";
  const canUpdateOwnAssignedStatus =
    (appUser.role === "field" || appUser.role === "contractor") &&
    typedTask.assigned_user_id === authUser.id &&
    !isCompleted;

  const canUseQuickStatusActions =
    (canManageTask && !isCompleted) || canUpdateOwnAssignedStatus;

  const canReopenTask = canManageTask && isCompleted;
  const canShowEditButton = canManageTask && !isCompleted;
  const canAddReport =
    (canManageTask || typedTask.assigned_user_id === authUser.id) && !isCompleted;
  const canShowAssignmentActions = canManageTask && !isCompleted;
  const canDeleteTask = canManageTask && !isAutoTask;
  const isMyTask = typedTask.assigned_user_id === authUser.id;

  const userIdsToLoad = Array.from(
    new Set(
      [
        typedTask.assigned_user_id,
        typedTask.created_by_user_id,
        typedTask.reported_by_user_id,
      ].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  let userMap = new Map<string, AppUserRow>();

  if (userIdsToLoad.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("app_users")
      .select("id, email, full_name, role")
      .in("id", userIdsToLoad);

    if (usersError) {
      throw new Error(`Failed to load task users: ${usersError.message}`);
    }

    userMap = new Map(
      ((users || []) as AppUserRow[]).map((user) => [user.id, user])
    );
  }

  const assignedUser = typedTask.assigned_user_id
    ? userMap.get(typedTask.assigned_user_id) || null
    : null;

  const createdByUser = typedTask.created_by_user_id
    ? userMap.get(typedTask.created_by_user_id) || null
    : null;

  const reportedByUser = typedTask.reported_by_user_id
    ? userMap.get(typedTask.reported_by_user_id) || null
    : null;

  let property: PropertyRow | null = null;

  if (typedTask.property_id) {
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id, property_code, title, address_line_1")
      .eq("id", typedTask.property_id)
      .single();

    if (propertyError && propertyError.code !== "PGRST116") {
      throw new Error(`Failed to load property: ${propertyError.message}`);
    }

    property = (propertyData as PropertyRow | null) || null;
  }

  let service: ServiceRow | null = null;

  if (typedTask.service_id) {
    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .select("id, name")
      .eq("id", typedTask.service_id)
      .single();

    if (serviceError && serviceError.code !== "PGRST116") {
      throw new Error(`Failed to load service: ${serviceError.message}`);
    }

    service = (serviceData as ServiceRow | null) || null;
  }

  let subscription: SubscriptionRow | null = null;
  let subscriptionPackage: PackageRow | null = null;

  if (typedTask.subscription_id) {
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("id, package_name_snapshot, package_id")
      .eq("id", typedTask.subscription_id)
      .single();

    if (subscriptionError && subscriptionError.code !== "PGRST116") {
      throw new Error(`Failed to load subscription: ${subscriptionError.message}`);
    }

    subscription = (subscriptionData as SubscriptionRow | null) || null;

    if (subscription?.package_id) {
      const { data: packageData, error: packageError } = await supabase
        .from("packages")
        .select("id, name")
        .eq("id", subscription.package_id)
        .single();

      if (packageError && packageError.code !== "PGRST116") {
        throw new Error(`Failed to load package: ${packageError.message}`);
      }

      subscriptionPackage = (packageData as PackageRow | null) || null;
    }
  }

  const assignedUserLabel =
    typedTask.assigned_user_name_snapshot ||
    (assignedUser ? getPersonLabel(assignedUser) : null) ||
    "Unassigned";
  const createdByUserLabel =
    typedTask.created_by_user_name_snapshot ||
    (createdByUser ? getPersonLabel(createdByUser) : null) ||
    "Not recorded";
  const reportedByUserLabel =
    typedTask.reported_by_user_name_snapshot ||
    (reportedByUser ? getPersonLabel(reportedByUser) : null) ||
    "-";
  const propertyLabel = typedTask.property_code_snapshot
    ? typedTask.property_code_snapshot
    : property
    ? [
        property.property_code,
        property.title,
        property.address_line_1,
      ]
        .filter(Boolean)
        .join(" - ")
    : "-";
  const serviceLabel =
    typedTask.service_name_snapshot || service?.name || typedTask.service_id || "-";
  const subscriptionPackageLabel =
    typedTask.subscription_package_name_snapshot ||
    subscription?.package_name_snapshot ||
    subscriptionPackage?.name ||
    "-";

  const { data: reports, error: reportsError } = await supabase
    .from("task_reports")
    .select(
      "id, report_type, notes, created_at, created_by_user_id, status_at_submission"
    )
    .eq("task_id", typedTask.id)
    .order("created_at", { ascending: false });

  if (reportsError) {
    throw new Error(`Failed to load reports: ${reportsError.message}`);
  }

  const typedReports: TaskReportRow[] = (reports || []) as TaskReportRow[];

  const reportUserIds = Array.from(
    new Set(
      typedReports
        .map((report) => report.created_by_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let reportUserMap = new Map<string, AppUserRow>();

  if (reportUserIds.length > 0) {
    const { data: reportUsers, error: reportUsersError } = await supabase
      .from("app_users")
      .select("id, email, full_name, role")
      .in("id", reportUserIds);

    if (reportUsersError) {
      throw new Error(
        `Failed to load report users: ${reportUsersError.message}`
      );
    }

    reportUserMap = new Map(
      ((reportUsers || []) as AppUserRow[]).map((user) => [user.id, user])
    );
  }

  const { data: attachments, error: attachmentsError } = await supabase
    .from("task_attachments")
    .select("id, task_report_id, storage_path, file_name")
    .eq("task_id", typedTask.id);

  if (attachmentsError) {
    throw new Error(`Failed to load attachments: ${attachmentsError.message}`);
  }

  const typedAttachments: TaskAttachmentRow[] =
    (attachments || []) as TaskAttachmentRow[];

  const attachmentsByReport = new Map<string, ReportImageRow[]>();

  for (const attachment of typedAttachments) {
    if (!attachment.task_report_id) continue;

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(attachment.storage_path, 60 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      continue;
    }

    if (!attachmentsByReport.has(attachment.task_report_id)) {
      attachmentsByReport.set(attachment.task_report_id, []);
    }

    attachmentsByReport.get(attachment.task_report_id)!.push({
      id: attachment.id,
      file_name: attachment.file_name,
      signed_url: signedUrlData.signedUrl,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{typedTask.title || "Untitled Task"}</h1>
          <p className="page-subtitle">
            Task ID: <span className="font-medium">{typedTask.id}</span>
          </p>
          <p className="page-subtitle mt-1">
            Signed in as: <strong>{appUser.role}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/tasks" className="btn btn-secondary">
            Back to Tasks
          </Link>

          {canShowEditButton ? (
            <Link href={`/tasks/${typedTask.id}/edit`} className="btn">
              Edit Task
            </Link>
          ) : null}
        </div>
      </div>

      {isAutoTask ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This is an auto-generated subscription task. It can be worked on and reassigned, but it cannot be deleted manually.
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
            typedTask.status
          )}`}
        >
          {formatLabel(typedTask.status)}
        </span>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getPriorityClasses(
            typedTask.priority
          )}`}
        >
          {formatLabel(typedTask.priority)} Priority
        </span>

        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
          {isAutoTask ? "Subscription Task" : "Manual Task"}
        </span>

        {isMyTask ? (
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            My Task
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="card">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Description
              </h2>

              {typedTask.description ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-900">
                  {typedTask.description}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No description provided.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Task Summary
              </h2>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs uppercase text-gray-500">Source</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {isAutoTask ? "Subscription" : "Manual"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatLabel(typedTask.status)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">Priority</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatLabel(typedTask.priority)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">Due Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(typedTask.due_date)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">Property</dt>
                  <dd className="mt-1 text-sm text-gray-900">{propertyLabel}</dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Subscription Link
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {typedTask.subscription_id || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Quick Actions
              </h2>

              <div className="flex flex-wrap gap-3">
                {canUseQuickStatusActions && typedTask.status !== "in_progress" ? (
                  <form action={markTaskInProgress}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <button type="submit" className="btn">
                      Mark In Progress
                    </button>
                  </form>
                ) : null}

                {canUseQuickStatusActions && typedTask.status !== "completed" ? (
                  <form action={markTaskCompleted}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <button type="submit" className="btn">
                      Mark Completed
                    </button>
                  </form>
                ) : null}

                {canReopenTask ? (
                  <form action={reopenTask}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Reopen Task
                    </button>
                  </form>
                ) : null}

                {canShowAssignmentActions && !isMyTask ? (
                  <form action={assignTaskToMe}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Assign to Me
                    </button>
                  </form>
                ) : null}

                {canShowAssignmentActions && typedTask.assigned_user_id ? (
                  <form action={unassignTask}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Unassign
                    </button>
                  </form>
                ) : null}

                {isCompleted ? (
                  <div className="text-sm text-gray-500">
                    This task is completed. Reopen it to continue work.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Reports & Photos
                </h2>

                {canAddReport ? (
                  <Link href={`/tasks/${typedTask.id}/report`} className="btn">
                    + Add Report
                  </Link>
                ) : null}
              </div>

              {typedReports.length === 0 ? (
                <p className="text-sm text-gray-500">No reports yet.</p>
              ) : (
                <div className="space-y-6">
                  {typedReports.map((report) => {
                    const reportAuthor = report.created_by_user_id
                      ? reportUserMap.get(report.created_by_user_id) || null
                      : null;

                    const reportImages = attachmentsByReport.get(report.id) || [];

                    return (
                      <div
                        key={report.id}
                        className="border border-gray-200 rounded-lg p-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                              {formatLabel(report.report_type)}
                            </span>

                            {report.status_at_submission ? (
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                                Status: {formatLabel(report.status_at_submission)}
                              </span>
                            ) : null}

                            <span className="text-xs text-gray-500">
                              {formatDateTime(report.created_at)}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500">
                            {reportAuthor
                              ? getPersonLabel(reportAuthor)
                              : "Unknown User"}
                          </div>
                        </div>

                        {report.notes ? (
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">
                            {report.notes}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No notes provided.
                          </p>
                        )}

                        {reportImages.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {reportImages.map((image) => (
                              <a
                                key={image.id}
                                href={image.signed_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={image.signed_url}
                                  alt={image.file_name || "Task photo"}
                                  className="w-full h-32 object-cover rounded border border-gray-200"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                People
              </h2>

              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Assigned To
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {assignedUserLabel !== "Unassigned" ? (
                      <div>
                        <div>{assignedUserLabel}</div>
                        {assignedUser && getRoleLabel(assignedUser) ? (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {getRoleLabel(assignedUser)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">Unassigned</span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Created By
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {createdByUserLabel !== "Not recorded" ? (
                      <div>
                        <div>{createdByUserLabel}</div>
                        {createdByUser && getRoleLabel(createdByUser) ? (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {getRoleLabel(createdByUser)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">Not recorded</span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Reported By
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {reportedByUserLabel}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Timeline
              </h2>

              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(typedTask.created_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(typedTask.updated_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">Due Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(typedTask.due_date)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Completed
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDateTime(typedTask.completed_at)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Source Info
              </h2>

              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase text-gray-500">Task Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {isAutoTask ? "Auto-generated from subscription" : "Manual task"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Subscription ID
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 break-all">
                    {typedTask.subscription_id || "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Service
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 break-all">
                    {serviceLabel}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-gray-500">
                    Subscription Package
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 break-all">
                    {subscriptionPackageLabel}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {canManageTask ? (
            <div className="card border border-red-200">
              <div className="p-6">
                <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2">
                  Danger Zone
                </h2>

                {canDeleteTask ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Permanently delete this task. This action cannot be undone.
                    </p>

                    <DeleteTaskButton
                      taskId={typedTask.id}
                      deleteAction={deleteTask}
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Auto-generated subscription tasks cannot be deleted manually.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}



