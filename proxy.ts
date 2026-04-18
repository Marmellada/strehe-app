import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_PUBLIC_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/setup-password",
  "/auth/callback",
  "/unauthorized",
];

const MARKETING_LOCALES = new Set(["en", "sq", "de"]);
const MARKETING_PAGES = new Set(["services", "how-it-works", "about", "contact"]);

function isPublicPath(pathname: string) {
  if (
    AUTH_PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return true;
  }

  if (pathname === "/") {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return true;
  }

  if (!MARKETING_LOCALES.has(segments[0])) {
    return false;
  }

  return segments.length === 1 || (segments.length === 2 && MARKETING_PAGES.has(segments[1]));
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

  const isPublic = isPublicPath(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-strehe-surface", isPublic ? "public" : "app");

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

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

          response = NextResponse.next({
            request: { headers: requestHeaders },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (isPublic) {
    return response;
  }

  const claimsResult = await supabase.auth.getClaims();
  const rawClaims =
    (claimsResult.data as { claims?: { sub?: string }; sub?: string } | null);

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
