import type { MetadataRoute } from "next";
import { APP_SITE_HOST, PUBLIC_SITE_URL } from "@/lib/marketing/seo";

export const PRIVATE_ROUTE_PREFIXES = [
  "/api",
  "/auth",
  "/billing",
  "/clients",
  "/dashboard",
  "/expenses",
  "/finance",
  "/inspection-lab",
  "/keys",
  "/leads",
  "/packages",
  "/properties",
  "/services",
  "/settings",
  "/subscriptions",
  "/tasks",
  "/ui-preview",
  "/unauthorized",
  "/users",
  "/workers",
] as const;

const PUBLIC_CRAWLER_RULE = {
  allow: "/",
  disallow: [...PRIVATE_ROUTE_PREFIXES],
};

export function buildRobotsPolicy(hostname: string): MetadataRoute.Robots {
  if (hostname.toLowerCase() === APP_SITE_HOST) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: [
      { userAgent: "OAI-SearchBot", ...PUBLIC_CRAWLER_RULE },
      { userAgent: ["Googlebot", "Bingbot"], ...PUBLIC_CRAWLER_RULE },
      { userAgent: "*", ...PUBLIC_CRAWLER_RULE },
    ],
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
