// components/tasks/DeleteTaskButton.tsx
"use client";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Textarea";

interface DeleteTaskButtonProps {
  taskId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeleteTaskButton({
  taskId,
  deleteAction,
}: DeleteTaskButtonProps) {
  return (
    <form action={deleteAction} className="space-y-4">
      <input type="hidden" name="taskId" value={taskId} />
      <FormField label="Cancellation Reason" required>
        <Textarea
          id="cancelled_reason"
          name="cancelled_reason"
          rows={4}
          placeholder="Explain why this task is being cancelled."
          required
        />
      </FormField>
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        onClick={(e) => {
          if (!confirm("Cancel this task? The task record will be preserved.")) {
            e.preventDefault();
          }
        }}
      >
        Cancel Task
      </Button>
    </form>
  );
}
