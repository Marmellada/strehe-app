import Link from "next/link";
import { Button, FormField, Input, Textarea } from "@/components/ui";

const PROJECT_STATUSES = [
  "planned",
  "active",
  "paused",
  "completed",
] as const;

type HouseholdSpaceOption = {
  id: string;
  name: string;
};

type HouseholdProjectFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  spaces: HouseholdSpaceOption[];
  project?: {
    id: string;
    household_space_id: string;
    title: string;
    description: string | null;
    status: string;
    target_date: string | null;
  };
  cancelHref: string;
  submitLabel: string;
};

export function HouseholdProjectForm({
  action,
  spaces,
  project,
  cancelHref,
  submitLabel,
}: HouseholdProjectFormProps) {
  return (
    <form action={action} className="space-y-5">
      {project ? <input type="hidden" name="project_id" value={project.id} /> : null}

      <FormField id="household_space_id" label="Household space" required>
        <select
          id="household_space_id"
          name="household_space_id"
          defaultValue={project?.household_space_id ?? spaces[0]?.id}
          required
          className="flex h-10 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-color)] focus-visible:ring-offset-2"
        >
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="title" label="Project title" required>
        <Input
          id="title"
          name="title"
          defaultValue={project?.title ?? ""}
          maxLength={180}
          required
          placeholder="Kitchen renovation, family trip, yearly planning..."
        />
      </FormField>

      <FormField
        id="description"
        label="Shared notes and decisions"
        hint="Keep the current plan, important decisions, and context here."
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={project?.description ?? ""}
          rows={7}
          placeholder="What are we deciding, who is involved, and what happens next?"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="status" label="Status" required>
          <select
            id="status"
            name="status"
            defaultValue={project?.status ?? "planned"}
            required
            className="flex h-10 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-color)] focus-visible:ring-offset-2"
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="target_date" label="Target date">
          <Input
            id="target_date"
            name="target_date"
            type="date"
            defaultValue={project?.target_date ?? ""}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{submitLabel}</Button>
        <Button asChild type="button" variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
