"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function RouteError({
  error,
  unstable_retry,
  title,
  returnHref,
  returnLabel,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
  title: string;
  returnHref: string;
  returnLabel: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4" role="alert">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          This workspace could not load. No action was submitted. Retry the read or return to a safe workspace.
          {error.digest ? <span className="mt-1 block text-xs">Reference: {error.digest}</span> : null}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => unstable_retry()}>Try again</Button>
        <Button asChild variant="outline"><Link href={returnHref}>{returnLabel}</Link></Button>
      </div>
    </div>
  );
}
