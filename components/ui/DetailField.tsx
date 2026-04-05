import * as React from "react";
import { cn } from "@/lib/utils";

type DetailFieldProps = {
  label: string;
  value?: React.ReactNode;
  className?: string;
};

export function DetailField({
  label,
  value,
  className,
}: DetailFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">
        {value ?? "-"}
      </div>
    </div>
  );
}