import {
  analyzeBathroomBaseShot,
  analyzeBathroomObjectsWithAi,
  detectRoomObjectsInPhotoWithAi,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
  mergeBathroomAiFindings,
} from "@/lib/inspection-lab/bathroom-base-shot-engine.mjs";

const engine = {
  analyzeBathroomBaseShot: analyzeBathroomBaseShot as (
    input: Buffer,
    label?: string
  ) => Promise<unknown>,
  analyzeBathroomObjectsWithAi: analyzeBathroomObjectsWithAi as (
    roomType: string,
    baselineInput: Buffer,
    currentInput: Buffer,
    deterministicComparison: Record<string, unknown>
  ) => Promise<unknown>,
  detectRoomObjectsInPhotoWithAi: detectRoomObjectsInPhotoWithAi as (
    roomType: string,
    imageInput: Buffer
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
  mergeBathroomAiFindings: mergeBathroomAiFindings as (
    comparison: Record<string, unknown>,
    aiAnalysis: unknown
  ) => Record<string, unknown>,
};

export default engine;
