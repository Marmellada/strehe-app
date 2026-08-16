import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildRobotsPolicy } from "@/lib/marketing/indexing";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers();
  const hostname = (
    headerStore.get("x-forwarded-host") || headerStore.get("host") || ""
  )
    .split(":")[0]
    .toLowerCase();

  return buildRobotsPolicy(hostname);
}
