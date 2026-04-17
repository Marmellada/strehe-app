import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";

export default async function RoomStateInspectionLabPage() {
  await requireRole(["admin"]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Inspection Lab"
        description="This experimental inspection workflow is paused and is not part of the v1 product surface."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">Back to Settings</Link>
          </Button>
        }
      />

      <Alert variant="info">
        <AlertTitle>Paused internal work</AlertTitle>
        <AlertDescription>
          The inspection lab stays in the repository for future v2 work, but it is currently quarantined from the launch-facing product.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Why this page is paused</CardTitle>
          <CardDescription>
            We explored room-state capture and manual object review here, but the launch focus is the core property operations workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The v1 focus remains on clients, properties, contracts, tasks, keys, billing, expenses, finance, workers, and settings.
          </p>
          <p>
            When inspection work comes back later, we can reopen this area without losing the exploratory code and architecture decisions already made.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}