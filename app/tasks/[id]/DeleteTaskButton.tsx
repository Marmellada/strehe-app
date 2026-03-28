"use client";

import { useFormStatus } from "react-dom";

export default function DeleteTaskButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-danger" disabled={pending}>
      {pending ? "Deleting..." : "Delete Task"}
    </button>
  );
}