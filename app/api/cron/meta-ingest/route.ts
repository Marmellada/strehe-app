import { createMetaIngestHandler } from "@/lib/server/meta-ingest-handler";

const handleMetaIngest = createMetaIngestHandler();

// GET for future Vercel Cron (Pro); POST for Supabase Cron (Hobby fallback).
// Both enforce the same Bearer CRON_SECRET authorization.
export const GET = handleMetaIngest;
export const POST = handleMetaIngest;
