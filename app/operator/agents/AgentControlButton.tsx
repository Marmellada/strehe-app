"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

export function AgentControlButton({ children, variant = "outline" }: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary";
}) {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant={variant} disabled={pending}>{pending ? "Working…" : children}</Button>;
}
