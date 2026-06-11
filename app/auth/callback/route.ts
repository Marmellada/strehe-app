import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getDefaultAppPath } from "@/lib/auth/default-path";
import { isAppRole } from "@/lib/auth/roles";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const supabase = await createClient();

  let error: { message: string } | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    error = result.error;
  } else {
    return NextResponse.redirect(
      new URL(
        `/auth/login?error=${encodeURIComponent(
          "Missing auth callback token."
        )}`,
        requestUrl.origin
      )
    );
  }

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/auth/login?error=${encodeURIComponent(error.message)}`,
        requestUrl.origin
      )
    );
  }

  if (safeNext === "/dashboard") {
    const claimsResult = await supabase.auth.getClaims();
    const rawClaims = claimsResult.data as
      | { claims?: { sub?: string }; sub?: string }
      | null;
    const userId = (rawClaims?.claims ?? rawClaims)?.sub ?? null;

    const { data: appUser } = await supabase
      .from("app_users")
      .select("role")
      .eq("id", userId ?? "")
      .maybeSingle();

    if (isAppRole(appUser?.role)) {
      return NextResponse.redirect(
        new URL(getDefaultAppPath(appUser.role), requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
