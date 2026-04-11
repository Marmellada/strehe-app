"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from "@/components/ui";

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
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Account Access
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Set password
          </h1>
          <p className="text-sm text-muted-foreground">
            Finish account setup before signing in.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form action={updatePasswordAction} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {awaitingSession ? (
                <Alert variant="info">
                  <AlertDescription>
                    Validating your invite or reset link. If this takes more
                    than a moment, open the email link again.
                  </AlertDescription>
                </Alert>
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
