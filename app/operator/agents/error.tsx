"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AgentsError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteError {...props} title="Engineering workspace unavailable" returnHref="/operator/review" returnLabel="Return to review queue" />;
}
