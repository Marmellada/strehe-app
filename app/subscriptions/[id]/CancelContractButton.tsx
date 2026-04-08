"use client";

import { Button } from "@/components/ui/Button";

export default function CancelContractButton() {
  return (
    <Button
      type="submit"
      variant="destructive"
      onClick={(event) => {
        if (!confirm("Cancel this contract? Historical records will be preserved.")) {
          event.preventDefault();
        }
      }}
    >
      Cancel Contract
    </Button>
  );
}
