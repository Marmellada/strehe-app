import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Alert,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailField,
  EmptyState,
  FormField,
  Textarea,
} from "@/components/ui";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { deleteTask } from "./actions";
import {
  assignTaskToMe,
  escalateTask,
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
  blocked_reason: string | null;
  cancelled_reason: string | null;
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
      return "info" as const;
    case "in_progress":
      return "warning" as const;
    case "blocked":
    case "escalated":
      return "danger" as const;
    case "completed":
      return "success" as const;
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function getPriorityClasses(priority: string | null) {
  switch (priority) {
    case "urgent":
      return "danger" as const;
    case "high":
      return "warning" as const;
    case "medium":
      return "info" as const;
    case "low":
      return "neutral" as const;
    default:
      return "neutral" as const;
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
      blocked_reason,
      cancelled_reason,
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
  const isEscalated =
    typedTask.status === "escalated" || typedTask.status === "blocked";
  const isCancelled = typedTask.status === "cancelled";

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
    !isCompleted &&
    !isCancelled;

  const canUseQuickStatusActions =
    (canManageTask && !isCompleted && !isCancelled) || canUpdateOwnAssignedStatus;

  const canReopenTask = canManageTask && (isCompleted || isCancelled);
  const canShowEditButton = canManageTask && !isCompleted && !isCancelled;
  const canAddReport =
    (canManageTask || typedTask.assigned_user_id === authUser.id) && !isCompleted && !isCancelled;
  const canShowAssignmentActions = canManageTask && !isCompleted && !isCancelled;
  const canDeleteTask = canManageTask && !isAutoTask && !isCompleted && !isCancelled;
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
      <PageHeader
        title={typedTask.title || "Untitled Task"}
        description={`Task ID: ${typedTask.id}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/tasks">Back to Tasks</Link>
            </Button>

            {canShowEditButton ? (
              <Button asChild>
                <Link href={`/tasks/${typedTask.id}/edit`}>Edit Task</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {isAutoTask ? (
        <Alert variant="warning">
          <div>
            <div className="mb-1 font-medium">Auto-generated subscription task</div>
            <p className="text-sm">
              This task can be worked on and reassigned, but it cannot be cancelled manually.
            </p>
          </div>
        </Alert>
      ) : null}

      {isEscalated && typedTask.blocked_reason ? (
        <Alert variant="warning">
          <div>
            <div className="mb-1 font-medium">Escalation reason</div>
            <p className="text-sm whitespace-pre-wrap">{typedTask.blocked_reason}</p>
          </div>
        </Alert>
      ) : null}

      {isCancelled && typedTask.cancelled_reason ? (
        <Alert variant="destructive">
          <div>
            <div className="mb-1 font-medium">Cancellation reason</div>
            <p className="text-sm whitespace-pre-wrap">{typedTask.cancelled_reason}</p>
          </div>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={getStatusClasses(typedTask.status)}>
          {formatLabel(typedTask.status)}
        </Badge>

        <Badge variant={getPriorityClasses(typedTask.priority)}>
          {formatLabel(typedTask.priority)} Priority
        </Badge>

        <Badge variant="neutral">
          {isAutoTask ? "Subscription Task" : "Manual Task"}
        </Badge>

        {isMyTask ? (
          <Badge variant="info">My Task</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {typedTask.description ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {typedTask.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description provided.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task Summary</CardTitle>
              <CardDescription>Core operational details for this task.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField label="Source" value={isAutoTask ? "Subscription" : "Manual"} />
              <DetailField label="Status" value={formatLabel(typedTask.status)} />
              <DetailField label="Priority" value={formatLabel(typedTask.priority)} />
              <DetailField label="Due Date" value={formatDate(typedTask.due_date)} />
              <DetailField
                label="Property"
                value={
                  typedTask.property_id ? (
                    <Link href={`/properties/${typedTask.property_id}`} className="font-medium text-foreground underline">
                      {propertyLabel}
                    </Link>
                  ) : (
                    propertyLabel
                  )
                }
              />
              <DetailField
                label="Contract"
                value={
                  typedTask.subscription_id ? (
                    <div className="space-y-1">
                      <Link
                        href={`/subscriptions/${typedTask.subscription_id}`}
                        className="font-medium text-foreground underline"
                      >
                        Open Contract
                      </Link>
                      {subscriptionPackageLabel !== "-" ? (
                        <div className="text-sm text-muted-foreground">
                          Package: {subscriptionPackageLabel}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    "—"
                  )
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {canUseQuickStatusActions && typedTask.status !== "in_progress" ? (
                  <form action={markTaskInProgress}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <Button type="submit">Mark In Progress</Button>
                  </form>
                ) : null}

                {canUseQuickStatusActions && typedTask.status !== "completed" ? (
                  <form action={markTaskCompleted}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <Button type="submit">Mark Completed</Button>
                  </form>
                ) : null}

                {canReopenTask ? (
                  <form action={reopenTask}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <Button type="submit" variant="outline">Reopen Task</Button>
                  </form>
                ) : null}

                {canShowAssignmentActions && !isMyTask ? (
                  <form action={assignTaskToMe}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <Button type="submit" variant="outline">Assign to Me</Button>
                  </form>
                ) : null}

                {canShowAssignmentActions && typedTask.assigned_user_id ? (
                  <form action={unassignTask}>
                    <input type="hidden" name="taskId" value={typedTask.id} />
                    <Button type="submit" variant="outline">Unassign</Button>
                  </form>
                ) : null}

                {(isCompleted || isCancelled) ? (
                  <div className="text-sm text-muted-foreground">
                    This task is closed. Reopen it to continue work.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {canUseQuickStatusActions && !isEscalated ? (
            <Card>
              <CardHeader>
                <CardTitle>Escalate Task</CardTitle>
                <CardDescription>
                  Flag what needs office or admin attention so the next step is clear.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={escalateTask} className="space-y-4">
                  <input type="hidden" name="taskId" value={typedTask.id} />
                  <FormField label="Escalation Reason" required>
                    <Textarea
                      id="blocked_reason"
                      name="blocked_reason"
                      rows={4}
                      placeholder="Explain what needs intervention and what should happen next."
                      required
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button type="submit" variant="outline">
                      Mark Escalated
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Reports & Photos</CardTitle>
                <CardDescription>Operational updates, notes, and attached images.</CardDescription>
              </div>
              {canAddReport ? (
                <Button asChild>
                  <Link href={`/tasks/${typedTask.id}/report`}>Add Report</Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {typedReports.length === 0 ? (
                <EmptyState
                  title="No reports yet"
                  description="Once work updates are submitted, they will appear here with any attached photos."
                />
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
                        className="border rounded-lg p-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-card text-foreground border">
                              {formatLabel(report.report_type)}
                            </span>

                            {report.status_at_submission ? (
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-card text-foreground border">
                                Status: {formatLabel(report.status_at_submission)}
                              </span>
                            ) : null}

                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(report.created_at)}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {reportAuthor
                              ? getPersonLabel(reportAuthor)
                              : "Unknown User"}
                          </div>
                        </div>

                        {report.notes ? (
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {report.notes}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
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
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={image.signed_url}
                                  alt={image.file_name || "Task photo"}
                                  className="w-full h-32 object-cover rounded border"
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Assigned To
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {assignedUserLabel !== "Unassigned" ? (
                      <div>
                        <div>{assignedUserLabel}</div>
                        {assignedUser && getRoleLabel(assignedUser) ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {getRoleLabel(assignedUser)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Created By
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {createdByUserLabel !== "Not recorded" ? (
                      <div>
                        <div>{createdByUserLabel}</div>
                        {createdByUser && getRoleLabel(createdByUser) ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {getRoleLabel(createdByUser)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Not recorded</span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Reported By
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {reportedByUserLabel}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {formatDateTime(typedTask.created_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {formatDateTime(typedTask.updated_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">Due Date</dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {formatDate(typedTask.due_date)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Completed
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {formatDateTime(typedTask.completed_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Escalation Reason
                  </dt>
                  <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                    {typedTask.blocked_reason || "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Cancellation Reason
                  </dt>
                  <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                    {typedTask.cancelled_reason || "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">Task Type</dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {isAutoTask ? "Auto-generated from subscription" : "Manual task"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Subscription ID
                  </dt>
                  <dd className="mt-1 text-sm text-foreground break-all">
                    {typedTask.subscription_id ? (
                      <Link
                        href={`/subscriptions/${typedTask.subscription_id}`}
                        className="font-medium text-foreground underline"
                      >
                        {typedTask.subscription_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Service
                  </dt>
                  <dd className="mt-1 text-sm text-foreground break-all">
                    {typedTask.service_id ? (
                      <Link
                        href={`/services/${typedTask.service_id}`}
                        className="font-medium text-foreground underline"
                      >
                        {serviceLabel}
                      </Link>
                    ) : (
                      serviceLabel
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Subscription Package
                  </dt>
                  <dd className="mt-1 text-sm text-foreground break-all">
                    {subscriptionPackageLabel}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {canManageTask ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">Task Lifecycle</CardTitle>
              </CardHeader>
              <CardContent>

                {canDeleteTask ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Cancel this manual task. The task record will be preserved.
                    </p>
                    <DeleteTaskButton
                      taskId={typedTask.id}
                      deleteAction={deleteTask}
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {isAutoTask
                        ? "Auto-generated subscription tasks cannot be cancelled manually."
                        : "This task is already closed."}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}



