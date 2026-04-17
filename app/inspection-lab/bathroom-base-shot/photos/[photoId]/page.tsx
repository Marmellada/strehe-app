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

export default async function InspectionLabPhotoReviewPausedPage() {
  await requireRole(["admin"]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Inspection Photo Review"
        description="This experimental review surface is paused with the rest of the inspection lab."
        actions={
          <Button asChild variant="outline">
            <Link href="/inspection-lab/bathroom-base-shot">Back to Inspection Lab</Link>
          </Button>
        }
      />

      <Alert variant="info">
        <AlertTitle>Paused internal route</AlertTitle>
        <AlertDescription>
          Photo review and marker placement are being kept internal for a later phase and are not part of v1.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Not in launch scope</CardTitle>
          <CardDescription>
            This route remains available only as a placeholder so the paused inspection work stays tidy and easy to resume later.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The live product focus is the operational workflow around tasks, properties, contracts, billing, expenses, keys, and staff.
        </CardContent>
      </Card>
    </main>
  );
}