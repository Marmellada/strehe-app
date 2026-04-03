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

  const pathnameSafe = request.nextUrl.pathname;

  if (isPublicPath(pathnameSafe)) {
    return response;
  }

  // ✅ IMPORTANT FIX: use getClaims() instead of getUser()
  const { data } = await supabase.auth.getClaims();
const claims = data?.claims ?? null;

  const isAuthenticated = !!claims;

  if (!isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathnameSafe);

    const redirectResponse = NextResponse.redirect(loginUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  // OPTIONAL: still get user id for DB lookup
  const userId = claims.sub;

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

  if (pathnameSafe === "/keys" || pathnameSafe.startsWith("/keys/")) {
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