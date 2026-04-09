import * as React from "react";

import { cn } from "@/lib/utils";

export function TableShell({
  className,
  children,
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {children}
    </div>
  );
}

export function Table({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full text-sm text-[var(--table-body-text)]", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "bg-[var(--table-header-bg)] text-[var(--table-header-text)]",
        className
      )}
      {...props}
    />
  );
}

export function TableBody(props: React.ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TableRow({
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-t border-[var(--table-row-border)] align-top", className)}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left font-medium text-[var(--table-header-text)]",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3", className)} {...props} />;
}
