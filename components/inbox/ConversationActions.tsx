"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  setConversationState,
  type InboxAction,
} from "@/lib/actions/inbox";

type ConversationStatus = "open" | "resolved" | "archived";
type AttentionState = "needs_reply" | "waiting_customer" | "none";

type ConversationActionsProps = {
  conversationId: string;
  status: ConversationStatus;
  attentionState: AttentionState;
  unreadCount: number;
};

type ActionOption = {
  action: InboxAction;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
};

export function ConversationActions({
  conversationId,
  status,
  attentionState,
  unreadCount,
}: ConversationActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "archived") return null;

  const actions: ActionOption[] = [];

  if (unreadCount > 0) {
    actions.push({ action: "mark_read", label: "Mark Read", variant: "outline" });
  }

  if (status === "open") {
    if (attentionState !== "needs_reply") {
      actions.push({ action: "needs_reply", label: "Needs Reply", variant: "outline" });
    }
    if (attentionState !== "waiting_customer") {
      actions.push({
        action: "waiting_customer",
        label: "Waiting Customer",
        variant: "outline",
      });
    }
    if (attentionState !== "none") {
      actions.push({
        action: "clear_attention",
        label: "Clear Attention",
        variant: "outline",
      });
    }
    actions.push({ action: "resolve", label: "Resolve", variant: "secondary" });
  } else if (status === "resolved") {
    actions.push({ action: "reopen", label: "Reopen" });
  }

  function runAction(action: InboxAction) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setConversationState(conversationId, action);
        if (!result.success) setError(result.error);
      } catch {
        setError("Unable to update the conversation. Please try again.");
      }
    });
  }

  return (
    <SectionCard title="Actions">
      <div className="flex flex-wrap gap-2">
        {actions.map((option) => (
          <Button
            key={option.action}
            type="button"
            variant={option.variant}
            disabled={isPending}
            onClick={() => runAction(option.action)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[var(--badge-danger-text)]" role="alert">
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}
