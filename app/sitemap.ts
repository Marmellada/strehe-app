import type { MetadataRoute } from "next";
import { buildPublicSitemap } from "@/lib/marketing/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildPublicSitemap();
}
