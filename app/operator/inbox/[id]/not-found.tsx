import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

export default function ConversationNotFound() {
  return (
    <EmptyState
      title="Conversation not found"
      description="The conversation does not exist, is no longer visible to this role, or has not been normalized into the operator inbox."
      action={<Button asChild><Link href="/operator/inbox">Return to inbox</Link></Button>}
    />
  );
}
