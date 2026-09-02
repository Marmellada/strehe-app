import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function RouteLoading({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingSpinner />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
