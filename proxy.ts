import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/auth/login", "/auth/logout", "/unauthorized"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(.*)$/)
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (isPublicPath(pathname)) {
    return response;
  }

  const claimsResult = await supabase.auth.getClaims();
  const rawClaims = (claimsResult.data as { claims?: { sub?: string }; sub?: string } | null);

  const claims = rawClaims?.claims ?? rawClaims ?? null;
  const userId = claims?.sub ?? null;

  if (!userId) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role, is_active")
    .eq("id", userId)
    .single();

  if (!appUser || !appUser.is_active) {
    const unauthorizedResponse = NextResponse.redirect(
      new URL("/unauthorized", request.url)
    );

    response.cookies.getAll().forEach((cookie) => {
      unauthorizedResponse.cookies.set(cookie);
    });

    return unauthorizedResponse;
  }

  if (pathname === "/keys" || pathname.startsWith("/keys/")) {
    if (appUser.role === "contractor") {
      const unauthorizedResponse = NextResponse.redirect(
        new URL("/unauthorized", request.url)
      );

      response.cookies.getAll().forEach((cookie) => {
        unauthorizedResponse.cookies.set(cookie);
      });

      return unauthorizedResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};