import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

export default function EngineeringJobNotFound() {
  return (
    <EmptyState
      title="Engineering job not found"
      description="The job does not exist, is outside the Engineering capability, or is not visible to this operator role."
      action={<Button asChild><Link href="/operator/review">Return to review queue</Link></Button>}
    />
  );
}
