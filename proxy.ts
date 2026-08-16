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
const MARKETING_PAGES = new Set([
  "packages",
  "services",
  "how-it-works",
  "about",
  "contact",
]);
const LEGAL_PUBLIC_PATHS = new Set(["/privacy", "/terms", "/data-deletion"]);
const APPLICATION_ROOTS = new Set([
  "api",
  "auth",
  "billing",
  "clients",
  "dashboard",
  "expenses",
  "finance",
  "inspection-lab",
  "keys",
  "leads",
  "packages",
  "properties",
  "services",
  "settings",
  "subscriptions",
  "tasks",
  "ui-preview",
  "unauthorized",
  "users",
  "workers",
]);
const PUBLIC_SITE_HOST = "www.streheprona.com";
const APEX_SITE_HOST = "streheprona.com";
const APP_HOST = "app.streheprona.com";

function isMarketingPath(pathname: string) {
  if (LEGAL_PUBLIC_PATHS.has(pathname)) {
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

  return (
    segments.length === 1 ||
    (segments.length === 2 && MARKETING_PAGES.has(segments[1]))
  );
}

function isAuthPublicPath(pathname: string) {
  return AUTH_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function isInvalidPublicPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || LEGAL_PUBLIC_PATHS.has(pathname)) {
    return false;
  }

  if (MARKETING_LOCALES.has(segments[0])) {
    return !isMarketingPath(pathname);
  }

  return !APPLICATION_ROOTS.has(segments[0]);
}

function withAppIndexProtection<T extends NextResponse>(
  response: T,
  hostname: string
) {
  if (hostname === APP_HOST) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

function redirectToHost(
  request: NextRequest,
  hostname: string,
  pathname = request.nextUrl.pathname
) {
  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.hostname = hostname;
  url.port = "";
  url.pathname = pathname;
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.hostname
  )
    .split(":")[0]
    .toLowerCase();

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(.*)$/)
  ) {
    return withAppIndexProtection(NextResponse.next({ request }), hostname);
  }

  const isMarketing = isMarketingPath(pathname);
  const isAuthPublic = isAuthPublicPath(pathname);
  const isPublicNotFound = hostname !== APP_HOST && isInvalidPublicPath(pathname);
  const isPublic = isMarketing || isAuthPublic || isPublicNotFound;

  if (hostname === APEX_SITE_HOST) {
    return redirectToHost(request, PUBLIC_SITE_HOST);
  }

  if (hostname === PUBLIC_SITE_HOST && !isMarketing && !isPublicNotFound) {
    return redirectToHost(request, APP_HOST);
  }

  if (hostname === APP_HOST && isMarketing) {
    if (pathname === "/") {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return withAppIndexProtection(
        NextResponse.redirect(dashboardUrl, 307),
        hostname
      );
    }

    return withAppIndexProtection(
      redirectToHost(request, PUBLIC_SITE_HOST),
      hostname
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-strehe-locale");
  requestHeaders.set(
    "x-strehe-surface",
    isMarketing || isPublicNotFound ? "public" : "app"
  );
  const routeLocale = pathname.split("/").filter(Boolean)[0];
  if (MARKETING_LOCALES.has(routeLocale)) {
    requestHeaders.set("x-strehe-locale", routeLocale);
  }

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (isPublic) {
    return withAppIndexProtection(response, hostname);
  }

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

    return withAppIndexProtection(redirectResponse, hostname);
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

    return withAppIndexProtection(unauthorizedResponse, hostname);
  }

  if (pathname === "/keys" || pathname.startsWith("/keys/")) {
    if (appUser.role === "contractor") {
      const unauthorizedResponse = NextResponse.redirect(
        new URL("/unauthorized", request.url)
      );

      response.cookies.getAll().forEach((cookie) => {
        unauthorizedResponse.cookies.set(cookie);
      });

      return withAppIndexProtection(unauthorizedResponse, hostname);
    }
  }

  return withAppIndexProtection(response, hostname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
