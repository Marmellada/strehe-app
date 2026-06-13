import {
  analyzeBathroomBaseShot,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
} from "@/lib/inspection-lab/bathroom-base-shot-engine.mjs";

const engine = {
  analyzeBathroomBaseShot: analyzeBathroomBaseShot as (
    input: Buffer,
    label?: string
  ) => Promise<unknown>,
  buildBathroomMarkdownReport: buildBathroomMarkdownReport as (
    caseId: string,
    roomType: string,
    baseline: unknown,
    current: unknown,
    comparison: Record<string, unknown>
  ) => string,
  buildBathroomNarrative: buildBathroomNarrative as (
    caseId: string,
    comparison: Record<string, unknown>
  ) => string,
  compareBathroomBaseShots: compareBathroomBaseShots as (
    baseline: unknown,
    current: unknown
  ) => Record<string, unknown>,
};

export default engine;
