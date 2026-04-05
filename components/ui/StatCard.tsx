import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

type StatCardProps = {
  title: string;
  value: React.ReactNode;
};

export function StatCard({ title, value }: StatCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}