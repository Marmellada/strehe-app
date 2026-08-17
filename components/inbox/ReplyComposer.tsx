"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { sendReply } from "@/lib/actions/inbox";

type ReplyComposerProps = {
  conversationId: string;
};

export function ReplyComposer({ conversationId }: ReplyComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isInvalid = text.trim().length === 0 || text.length > 1000;

  function submitReply() {
    if (isInvalid || isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await sendReply(conversationId, text);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setText("");
      } catch {
        setError("Unable to send the reply. Please try again.");
      }
    });
  }

  return (
    <SectionCard title="Reply" description="Send a plain-text message through Meta.">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Write a reply"
        disabled={isPending}
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
    </SectionCard>
  );
}
