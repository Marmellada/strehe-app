"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { setConversationAssignment } from "@/lib/actions/inbox";

type UserOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AssignmentControlProps = {
  conversationId: string;
  status: "open" | "resolved" | "archived";
  assigned: UserOption | null;
  candidates: UserOption[];
};

const UNASSIGNED = "unassigned";

function getUserLabel(user: UserOption) {
  return user.full_name || user.email || "Unnamed user";
}

export function AssignmentControl({
  conversationId,
  status,
  assigned,
  candidates,
}: AssignmentControlProps) {
  const initialValue = assigned?.id || UNASSIGNED;
  const [selected, setSelected] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const assignedIsCandidate = assigned
    ? candidates.some((candidate) => candidate.id === assigned.id)
    : false;
  const hasChanged = selected !== initialValue;
  const actionLabel =
    selected === UNASSIGNED ? "Unassign" : assigned ? "Change" : "Assign";

  function saveAssignment() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setConversationAssignment(
          conversationId,
          selected === UNASSIGNED ? null : selected
        );
        if (!result.success) setError(result.error);
      } catch {
        setError("Unable to update assignment. Please try again.");
      }
    });
  }

  return (
    <SectionCard title="Assignment">
      <p className="mb-3 text-sm text-muted-foreground">
        Current: {assigned ? getUserLabel(assigned) : "Unassigned"}
      </p>
      {status === "archived" ? (
        <p className="text-sm text-muted-foreground">Archived conversations cannot be reassigned.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selected} onValueChange={setSelected} disabled={isPending}>
            <SelectTrigger className="sm:max-w-sm">
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {assigned && !assignedIsCandidate ? (
                <SelectItem value={assigned.id} disabled>
                  {getUserLabel(assigned)} (inactive)
                </SelectItem>
              ) : null}
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {getUserLabel(candidate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" disabled={isPending || !hasChanged} onClick={saveAssignment}>
            {actionLabel}
          </Button>
        </div>
      )}
      {error ? (
        <p className="mt-3 text-sm text-[var(--badge-danger-text)]" role="alert">{error}</p>
      ) : null}
    </SectionCard>
  );
}
