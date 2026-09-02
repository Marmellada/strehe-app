import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";

type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  contentClassName?: string;
  action?: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  children,
  contentClassName,
  action,
}: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
