"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { sendReply } from "@/lib/actions/inbox";

type ReplyComposerProps = {
  conversationId: string;
  replyWindow: {
    isOpen: boolean;
    closesAt: string | null;
    reason: string;
  };
};

export function ReplyComposer({ conversationId, replyWindow }: ReplyComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isInvalid =
    !replyWindow.isOpen || text.trim().length === 0 || text.length > 1000;

  function submitReply() {
    if (isInvalid || isPending) return;
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const result = await sendReply(conversationId, text);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setText("");
        setStatus("Reply sent and recorded in the conversation history.");
      } catch {
        setError("Unable to send the reply. Please try again.");
      }
    });
  }

  return (
    <SectionCard title="Reply" description="Send a plain-text message through Meta.">
      <Alert variant={replyWindow.isOpen ? "info" : "warning"} className="mb-4">
        <AlertTitle>{replyWindow.isOpen ? "24-hour reply window open" : "Reply window closed"}</AlertTitle>
        <AlertDescription>
          {replyWindow.reason}
          {replyWindow.closesAt ? (
            <span className="mt-1 block">
              Window boundary: {new Date(replyWindow.closesAt).toLocaleString("en-GB")}
            </span>
          ) : null}
        </AlertDescription>
      </Alert>
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Write a reply"
        disabled={isPending || !replyWindow.isOpen}
        aria-invalid={Boolean(error)}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{text.length}/1000</span>
        <Button type="button" disabled={isInvalid || isPending} onClick={submitReply}>
          {isPending ? "Sending…" : "Send"}
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[var(--badge-danger-text)]" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-3 text-sm text-[var(--badge-success-text)]" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </SectionCard>
  );
}
