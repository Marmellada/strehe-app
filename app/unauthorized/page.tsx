import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  PageHeader,
  SectionCard,
} from "@/components/ui";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <PageHeader
        title="Access Denied"
        subtitle="You do not have permission to access this page."
      />

      <SectionCard
        title="Permission Required"
        description="This area is limited to users with the required access level."
      >
        <div className="space-y-4">
          <Alert variant="warning">
            <AlertTitle>Restricted page</AlertTitle>
            <AlertDescription>
              If you expected to see this page, check your role or sign in with
              the correct account.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/auth/logout">Logout</Link>
            </Button>
          </div>
        </div>
      </SectionCard>
    </main>
  );
}
