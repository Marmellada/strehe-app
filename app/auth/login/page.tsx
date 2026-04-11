import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
}

async function loginAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const admin = getAdminClient();

  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "").trim();

  if (!identifier || !password) {
    redirect(
      "/auth/login?error=Please%20enter%20your%20username%20or%20email%20and%20password"
    );
  }

  const safeNext = next.startsWith("/") ? next : "/";
  let email = identifier.toLowerCase();

  if (!identifier.includes("@")) {
    const { data: appUser, error: lookupError } = await admin
      .from("app_users")
      .select("email")
      .eq("username", identifier.toLowerCase())
      .maybeSingle();

    if (lookupError || !appUser?.email) {
      redirect(
        `/auth/login?error=${encodeURIComponent(
          "Invalid login credentials"
        )}&next=${encodeURIComponent(safeNext)}`
      );
    }

    email = appUser.email.toLowerCase();
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/auth/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(
        safeNext
      )}`
    );
  }

  redirect(safeNext);
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params?.next && params.next.startsWith("/") ? params.next : "/";
  const error = params?.error || "";

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <PageHeader
          title="Sign in"
          description="Access STREHË Admin"
        />

        <Card>
          <CardContent className="pt-6">
            <form action={loginAction} className="space-y-4">
              <input type="hidden" name="next" value={nextPath} />

              {error && (
                <div className="badge warn">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier">Username or Email</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  placeholder="milot.berisha or you@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
