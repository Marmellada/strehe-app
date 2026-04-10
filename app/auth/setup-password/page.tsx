import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, CardContent, Input, Label, PageHeader } from "@/components/ui";

interface SetupPasswordPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

async function updatePasswordAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (password.length < 8) {
    redirect(
      `/auth/setup-password?error=${encodeURIComponent(
        "Password must be at least 8 characters."
      )}`
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/auth/setup-password?error=${encodeURIComponent(
        "Passwords do not match."
      )}`
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/auth/login?error=${encodeURIComponent(
        "Your setup session is no longer available. Open the email link again."
      )}`
    );
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirect(`/auth/setup-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export default async function SetupPasswordPage({
  searchParams,
}: SetupPasswordPageProps) {
  const params = await searchParams;
  const error = params?.error || "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth/login?error=${encodeURIComponent(
        "Open your invite or reset email again to set your password."
      )}`
    );
  }

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

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
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
                />
              </div>

              <Button type="submit" className="w-full">
                Save Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
