import { z } from "zod";

const SAFE_TEXT = /^[^<>{}\u0000-\u001f]*$/u;

function bounded(max: number) {
  return z.string().max(max).regex(SAFE_TEXT).transform((value) => {
    const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
    return normalized || null;
  });
}

export const attributionSchema = z.object({
  source_detail: bounded(160),
  campaign_name: bounded(160),
  utm_source: bounded(100),
  utm_medium: bounded(100),
  utm_campaign: bounded(160),
  utm_content: bounded(160),
  utm_term: bounded(160),
  click_id: bounded(200),
  landing_locale: bounded(10),
  landing_page: bounded(500),
});

export type Attribution = z.infer<typeof attributionSchema>;

export function normalizeAttribution(
  values: Record<keyof Attribution, string>
): Attribution {
  return attributionSchema.parse(values);
}

