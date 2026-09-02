import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  PageHeader,
  SectionCard,
} from "@/components/ui";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import {
  getRoleAccessMessage,
  getRoleReturnDestination,
} from "@/lib/operator/workflows";

export default async function UnauthorizedPage() {
  const current = await getCurrentUserWithRole();
  const role = current?.appUser.role ?? null;
  const destination = role ? getRoleReturnDestination(role) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <PageHeader
        title="Access Denied"
        subtitle={
          role
            ? `Your ${role} role does not have permission to access this page.`
            : "This account does not have permission to access the requested page."
        }
      />

      <SectionCard
        title="Permission Required"
        description="This area is limited to users with the required access level."
      >
        <div className="space-y-4">
          <Alert variant="warning">
            <AlertTitle>Restricted page</AlertTitle>
            <AlertDescription>
              {role
                ? getRoleAccessMessage(role)
                : "Sign in with an active application account or ask an administrator to verify your access."}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            {destination ? (
              <Button asChild>
                <Link href={destination.href}>{destination.label}</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/auth/logout">Logout</Link>
            </Button>
          </div>
        </div>
      </SectionCard>
    </main>
  );
}
