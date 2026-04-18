import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupPasswordContent } from "./SetupPasswordContent";
import { SetupPasswordSessionBridge } from "./SetupPasswordSessionBridge";

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

  redirect("/dashboard");
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

  return (
    <>
      <SetupPasswordSessionBridge />
      <SetupPasswordContent
        error={error}
        awaitingSession={!user}
        updatePasswordAction={updatePasswordAction}
      />
    </>
  );
}
