"use client";

import { Button } from "@/components/ui/Button";

export default function DeactivateServiceButton() {
  return (
    <Button
      type="submit"
      variant="destructive"
      onClick={(event) => {
        if (!confirm("Deactivate this service? Historical records will be preserved.")) {
          event.preventDefault();
        }
      }}
    >
      Deactivate
    </Button>
  );
}
