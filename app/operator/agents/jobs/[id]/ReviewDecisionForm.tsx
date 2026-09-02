"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { reviewEngineeringJobAction } from "@/app/operator/agents/actions";

function ReviewDecisionButtons() {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-2" aria-live="polite">
      <Button
        type="submit"
        name="decision"
        value="approved"
        disabled={pending}
      >
        {pending ? "Recording decision…" : "Approve result"}
      </Button>
      <Button
        type="submit"
        name="decision"
        value="rejected"
        variant="destructive"
        disabled={pending}
      >
        {pending ? "Recording decision…" : "Reject result"}
      </Button>
    </div>
  );
}

export function ReviewDecisionForm({ jobId }: { jobId: string }) {
  return (
    <form action={reviewEngineeringJobAction} className="space-y-4">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="space-y-2">
        <label htmlFor="review-notes" className="text-sm font-medium">
          Decision notes
        </label>
        <Textarea
          id="review-notes"
          name="notes"
          maxLength={4000}
          rows={4}
          placeholder="Record why this result is approved or rejected."
        />
        <p className="text-xs text-muted-foreground">
          The decision, reviewer, time, and these notes are stored together.
        </p>
      </div>
      <ReviewDecisionButtons />
    </form>
  );
}
