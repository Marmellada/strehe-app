import * as React from "react";

import { cn } from "@/lib/utils";

type ListToolbarProps = React.ComponentProps<"div"> & {
  actions?: React.ReactNode;
};

export function ListToolbar({
  className,
  actions,
  children,
  ...props
}: ListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
