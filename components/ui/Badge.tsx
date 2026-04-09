import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  success: "border-[color:var(--badge-success-bg)] bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]",
  warning: "border-[color:var(--badge-warning-bg)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]",
  danger: "border-[color:var(--badge-danger-bg)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)]",
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-[color:var(--badge-info-bg)] bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize leading-none whitespace-nowrap",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
