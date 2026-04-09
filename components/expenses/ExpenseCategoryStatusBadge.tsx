import { StatusBadge } from "@/components/ui";

type Props = {
  isActive: boolean;
};

export function ExpenseCategoryStatusBadge({ isActive }: Props) {
  return <StatusBadge status={isActive ? "active" : "inactive"} />;
}
