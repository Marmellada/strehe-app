"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function DashboardError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteError {...props} title="Dashboard unavailable" returnHref="/auth/logout" returnLabel="Switch account" />;
}
