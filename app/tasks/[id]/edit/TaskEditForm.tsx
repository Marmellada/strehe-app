"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, FormField, Input, Textarea } from "@/components/ui";
import type { User } from "@/lib/users";

type TaskEditRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  property_id: string | null;
  service_id: string | null;
  subscription_id: string | null;
  reported_by_user_id: string | null;
  assigned_user_id: string | null;
};

type PropertyOption = {
  id: string;
  property_code: string | null;
  title: string | null;
};

type ServiceOption = {
  id: string;
  name: string | null;
  category: string | null;
  default_title: string | null;
  default_description: string | null;
  default_priority: string | null;
};

type SubscriptionOption = {
  id: string;
  property_id: string | null;
  client?: {
    full_name: string | null;
    company_name: string | null;
  } | null;
  property?: {
    property_code: string | null;
    title: string | null;
  } | null;
  package?: {
    name: string | null;
  } | null;
};

type TaskEditFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  task: TaskEditRow;
  properties: PropertyOption[];
  users: User[];
  services: ServiceOption[];
  subscriptions: SubscriptionOption[];
};

export default function TaskEditForm({
  action,
  task,
  properties,
  users,
  services,
  subscriptions,
}: TaskEditFormProps) {
  const nativeSelectClassName =
    "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const [selectedPropertyId, setSelectedPropertyId] = useState(
    task.property_id || ""
  );
  const [selectedServiceId, setSelectedServiceId] = useState(
    task.service_id || ""
  );

  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority || "medium");

  const filteredSubscriptions = useMemo(() => {
    if (!selectedPropertyId) return [];
    return subscriptions.filter(
      (subscription) => subscription.property_id === selectedPropertyId
    );
  }, [subscriptions, selectedPropertyId]);

  const currentSubscriptionStillValid = filteredSubscriptions.some(
    (subscription) => subscription.id === task.subscription_id
  );

  return (
    <form action={action} className="card space-y-6">
      <input type="hidden" name="id" value={task.id} />

      <div className="grid grid-2 gap-4">
        <FormField label="Title *">
          <Input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Property *">
          <select
            id="property_id"
            name="property_id"
            required
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className={nativeSelectClassName}
          >
            <option value="" disabled>
              Select property
            </option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.property_code ? `${property.property_code} - ` : ""}
                {property.title}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Reported By">
          <select
            id="reported_by_user_id"
            name="reported_by_user_id"
            defaultValue={task.reported_by_user_id || ""}
            className={nativeSelectClassName}
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.role})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Assigned To">
          <select
            id="assigned_user_id"
            name="assigned_user_id"
            defaultValue={task.assigned_user_id || ""}
            className={nativeSelectClassName}
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.role})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Service">
          <select
            id="service_id"
            name="service_id"
            value={selectedServiceId}
            onChange={(e) => {
              const nextServiceId = e.target.value;
              const nextService =
                services.find((service) => service.id === nextServiceId) || null;
              setSelectedServiceId(nextServiceId);

              if (
                nextService &&
                (!task.title || title === task.title) &&
                nextService.default_title
              ) {
                setTitle(nextService.default_title);
              }

              if (
                nextService &&
                (!task.description || description === task.description) &&
                nextService.default_description
              ) {
                setDescription(nextService.default_description);
              }

              if (
                nextService &&
                (!task.priority || priority === task.priority) &&
                nextService.default_priority
              ) {
                setPriority(nextService.default_priority);
              }
            }}
            className={nativeSelectClassName}
          >
            <option value="">Select service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}{" "}
                {service.category ? `(${service.category})` : ""}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Subscription">
          <select
            id="subscription_id"
            name="subscription_id"
            defaultValue={
              currentSubscriptionStillValid ? task.subscription_id || "" : ""
            }
            className={nativeSelectClassName}
            disabled={!selectedPropertyId}
          >
            <option value="">
              {selectedPropertyId
                ? "Select subscription"
                : "Select property first"}
            </option>
            {filteredSubscriptions.map((subscription) => {
              const clientName =
                subscription.client?.company_name ||
                subscription.client?.full_name ||
                "Unknown Client";

              const propertyName =
                subscription.property?.property_code
                  ? `${subscription.property.property_code} - ${subscription.property?.title || ""}`
                  : subscription.property?.title || "Unknown Property";

              const packageName = subscription.package?.name || "No Package";

              return (
                <option key={subscription.id} value={subscription.id}>
                  {clientName} / {propertyName} / {packageName}
                </option>
                );
              })}
          </select>
        </FormField>

        <FormField label="Status">
          <select
            id="status"
            name="status"
            defaultValue={task.status || "open"}
            className={nativeSelectClassName}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FormField>

        <FormField label="Priority">
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={nativeSelectClassName}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </FormField>

        <FormField label="Due Date">
          <Input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={task.due_date || ""}
          />
        </FormField>

        <div className="col-span-2">
          <FormField label="Description">
          <Textarea
            id="description"
            name="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          </FormField>
        </div>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="ghost">
          <Link href={`/tasks/${task.id}`}>Cancel</Link>
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
