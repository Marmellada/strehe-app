// components/tasks/DeleteTaskButton.tsx
"use client";

import { Button } from "@/components/ui/Button";

interface DeleteTaskButtonProps {
  taskId: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeleteTaskButton({
  taskId,
  deleteAction,
}: DeleteTaskButtonProps) {
  return (
    <form action={deleteAction}>
      <input type="hidden" name="taskId" value={taskId} />
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
