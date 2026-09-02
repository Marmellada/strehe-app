"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function ReviewError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteError {...props} title="Review queue unavailable" returnHref="/dashboard" returnLabel="Return to dashboard" />;
}
