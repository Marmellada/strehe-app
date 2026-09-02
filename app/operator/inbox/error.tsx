"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function InboxError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteError {...props} title="Inbox unavailable" returnHref="/dashboard" returnLabel="Return to dashboard" />;
}
