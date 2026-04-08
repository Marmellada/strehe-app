"use client";

import { Button } from "@/components/ui/Button";

export default function DeleteClientButton() {
  return (
    <Button
      type="submit"
      variant="destructive"
      onClick={(e) => {
        if (!confirm("Deactivate this client? Historical records will be preserved.")) {
          e.preventDefault();
        }
      }}
    >
      Deactivate Client
    </Button>
  );
}
