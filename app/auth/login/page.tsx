import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
}

async function loginAction(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "").trim();

  if (!email || !password) {
    redirect("/auth/login?error=Please%20enter%20email%20and%20password");
  }

  const safeNext = next.startsWith("/") ? next : "/dashboard";

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(safeNext)}`);
  }

  redirect(safeNext);
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params?.next && params.next.startsWith("/") ? params.next : "/dashboard";
  const error = params?.error || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Sign in to STREHE Admin
          </h2>
        </div>

        <form className="mt-8 space-y-6" action={loginAction}>
          <input type="hidden" name="next" value={nextPath} />

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          ) : null}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                defaultValue=""
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                defaultValue=""
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}