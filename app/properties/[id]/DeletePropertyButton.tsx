"use client";

import { Button } from "@/components/ui/Button";

export default function DeletePropertyButton() {
  return (
    <Button
      type="submit"
      variant="destructive"
      onClick={(e) => {
        if (!confirm("Deactivate this property? Historical records will be preserved.")) {
          e.preventDefault();
        }
      }}
    >
      Deactivate Property
    </Button>
  );
}
