type Props = {
  isActive: boolean;
};

export function ExpenseCategoryStatusBadge({ isActive }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}