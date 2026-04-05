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
};

export function SectionCard({
  title,
  description,
  children,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}