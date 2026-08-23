import { createMetaAnalyticsHandler } from "@/lib/server/meta-analytics-handler";

const handleMetaAnalytics =
  createMetaAnalyticsHandler();

// GET supports Vercel Cron.
// POST supports the existing Supabase Cron fallback.
export const GET = handleMetaAnalytics;
export const POST = handleMetaAnalytics;