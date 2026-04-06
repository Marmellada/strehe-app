import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger:
    "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  neutral:
    "border-border bg-muted text-muted-foreground",
  info:
    "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
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