"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Button,
  FormField,
  Input,
  SectionCard,
  Textarea,
} from "@/components/ui";

type TaskUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TaskProperty = {
  id: string;
  property_code: string | null;
  title: string | null;
  address_line_1: string | null;
};

type TaskFormTask = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  blocked_reason?: string | null;
  cancelled_reason?: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  property_id: string | null;
  subscription_id?: string | null;
};

type TaskFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  users: TaskUser[];
  properties: TaskProperty[];
  cancelHref: string;
  submitLabel: string;
  task?: TaskFormTask;
  lockProperty?: boolean;
};

export default function TaskForm({
  action,
  users,
  properties,
  cancelHref,
  submitLabel,
  task,
  lockProperty = false,
}: TaskFormProps) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const [status, setStatus] = useState(task?.status ?? "open");
  const [blockedReason, setBlockedReason] = useState(
    task?.blocked_reason ?? ""
  );
  const [cancelledReason, setCancelledReason] = useState(
    task?.cancelled_reason ?? ""
  );

  return (
    <form action={action} className="space-y-6">
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}

      <SectionCard
        title="Task Details"
        description="Capture the task summary, assignment, and scheduling details."
      >
        <div className="space-y-6">
          <FormField id="title" label="Title" required>
            <Input
              id="title"
              name="title"
              required
              defaultValue={task?.title ?? ""}
            />
          </FormField>

          <FormField id="description" label="Description">
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={task?.description ?? ""}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField id="status" label="Status">
              <select
                id="status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={nativeSelectClassName}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </FormField>

            <FormField id="priority" label="Priority">
              <select
                id="priority"
                name="priority"
                defaultValue={task?.priority ?? "medium"}
                className={nativeSelectClassName}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </FormField>

            <FormField id="assigned_user_id" label="Assign To">
              <select
                id="assigned_user_id"
                name="assigned_user_id"
                defaultValue={task?.assigned_user_id ?? ""}
                className={nativeSelectClassName}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name?.trim() || user.email || "Unnamed User"}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="due_date" label="Due Date">
              <Input
                id="due_date"
                name="due_date"
                type="date"
                defaultValue={task?.due_date?.split("T")[0] ?? ""}
              />
            </FormField>
          </div>

          <FormField
            id="property_id"
            label="Property"
            required
            hint={
              lockProperty
                ? "Property is locked for auto-generated subscription tasks."
                : undefined
            }
          >
            <>
              <select
                id="property_id"
                name="property_id"
                defaultValue={task?.property_id ?? ""}
                required
                disabled={lockProperty}
                className={nativeSelectClassName}
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {[property.property_code, property.title, property.address_line_1]
                      .filter(Boolean)
                      .join(" — ")}
                  </option>
                ))}
              </select>

              {lockProperty ? (
                <input
                  type="hidden"
                  name="property_id"
                  value={task?.property_id ?? ""}
                />
              ) : null}
            </>
          </FormField>

          {status === "blocked" ? (
            <FormField
              id="blocked_reason"
              label="Blocked Reason"
              required
              hint="Explain what is preventing the task from moving forward."
            >
              <Textarea
                id="blocked_reason"
                name="blocked_reason"
                rows={4}
                value={blockedReason}
                onChange={(event) => setBlockedReason(event.target.value)}
                required
              />
            </FormField>
          ) : (
            <input type="hidden" name="blocked_reason" value="" />
          )}

          {status === "cancelled" ? (
            <FormField
              id="cancelled_reason"
              label="Cancellation Reason"
              required
              hint="Record why this task is being cancelled."
            >
              <Textarea
                id="cancelled_reason"
                name="cancelled_reason"
                rows={4}
                value={cancelledReason}
                onChange={(event) => setCancelledReason(event.target.value)}
                required
              />
            </FormField>
          ) : (
            <input type="hidden" name="cancelled_reason" value="" />
          )}
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancel</Link>
        </Button>

        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
