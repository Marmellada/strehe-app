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
        variant="danger"
        size="sm"
        onClick={(e) => {
          if (!confirm("Delete this task permanently?")) {
            e.preventDefault();
          }
        }}
      >
        Delete Task
      </Button>
    </form>
  );
}
