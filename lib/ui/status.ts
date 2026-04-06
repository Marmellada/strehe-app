export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info";

export function getStatusVariant(status: string | null | undefined): StatusBadgeVariant {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "active":
    case "paid":
    case "completed":
    case "done":
    case "approved":
      return "success";

    case "issued":
    case "in_progress":
    case "in progress":
    case "open":
      return "info";

    case "pending":
    case "draft":
    case "scheduled":
      return "warning";

    case "inactive":
    case "cancelled":
    case "canceled":
    case "archived":
    case "closed":
      return "neutral";

    case "overdue":
    case "failed":
    case "rejected":
      return "danger";

    default:
      return "neutral";
  }
}

export function formatStatusLabel(status: string | null | undefined): string {
  const normalized = String(status ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  if (!normalized) return "Unknown";

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}