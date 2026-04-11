"use client";

import { Button, Card, CardContent, Input, Label, PageHeader } from "@/components/ui";

type SetupPasswordContentProps = {
  error: string;
  awaitingSession: boolean;
  updatePasswordAction: (formData: FormData) => void;
};

export function SetupPasswordContent({
  error,
  awaitingSession,
  updatePasswordAction,
}: SetupPasswordContentProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <PageHeader
          title="Set password"
          description="Finish account setup before signing in."
        />

        <Card>
          <CardContent className="pt-6">
            <form action={updatePasswordAction} className="space-y-4">
              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              {awaitingSession ? (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Validating your invite or reset link. If this takes more than a
                  moment, open the email link again.
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  disabled={awaitingSession}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Repeat password"
                  disabled={awaitingSession}
                />
              </div>

              <Button type="submit" className="w-full" disabled={awaitingSession}>
                Save Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
