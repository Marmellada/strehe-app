import { Badge } from "./Badge";

const statusVariantMap: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  completed: "success",
  paid: "success",
  enabled: "success",
  idle: "success",
  online: "success",
  working: "info",
  acknowledged: "info",
  resolved: "success",
  issued: "info",
  sent: "info",
  info: "info",
  pending: "warning",
  overdue: "warning",
  draft: "warning",
  warning: "warning",
  open: "warning",
  deferred: "warning",
  inactive: "neutral",
  offline: "neutral",
  paused: "warning",
  cancelled: "danger",
  canceled: "danger",
  failed: "danger",
  error: "danger",
};

function formatStatusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type StatusBadgeProps = {
  status: string | null | undefined;
  fallbackLabel?: string;
};

export function StatusBadge({ status, fallbackLabel = "-" }: StatusBadgeProps) {
  if (!status) {
    return <Badge variant="neutral">{fallbackLabel}</Badge>;
  }

  const normalized = status.trim().toLowerCase();
  return (
    <Badge variant={statusVariantMap[normalized] ?? "neutral"}>
      {formatStatusLabel(status)}
    </Badge>
  );
}
