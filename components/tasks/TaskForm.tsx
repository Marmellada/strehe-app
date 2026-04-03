"use client";

import Link from "next/link";

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

const selectClass =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function TaskForm({
  action,
  users,
  properties,
  cancelHref,
  submitLabel,
  task,
  lockProperty = false,
}: TaskFormProps) {
  return (
    <form action={action} className="space-y-6">
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}

      <div className="grid grid-cols-1 gap-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1.5">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={task?.title ?? ""}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1.5">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={task?.description ?? ""}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1.5">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={task?.status ?? "open"}
            className={selectClass}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1.5">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={task?.priority ?? "medium"}
            className={selectClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label htmlFor="assigned_user_id" className="block text-sm font-medium text-gray-300 mb-1.5">
            Assign To
          </label>
          <select
            id="assigned_user_id"
            name="assigned_user_id"
            defaultValue={task?.assigned_user_id ?? ""}
            className={selectClass}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name?.trim() || user.email || "Unnamed User"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-gray-300 mb-1.5">
            Due Date
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={task?.due_date?.split("T")[0] ?? ""}
            className="input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="property_id" className="block text-sm font-medium text-gray-300 mb-1.5">
          Property
        </label>

        <select
          id="property_id"
          name="property_id"
          defaultValue={task?.property_id ?? ""}
          required
          disabled={lockProperty}
          className={selectClass}
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
          <>
            <input type="hidden" name="property_id" value={task?.property_id ?? ""} />
            <p className="mt-2 text-xs text-amber-300">
              Property is locked for auto-generated subscription tasks.
            </p>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
        <Link href={cancelHref} className="btn btn-secondary">
          Cancel
        </Link>

        <button type="submit" className="btn">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}