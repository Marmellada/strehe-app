// Growth Agent — V1 contract stub (disabled until the reporting layer exists).
// Recommend-only: MUST NOT publish content or spend money.
export default {
  agentKey: "growth.local",
  capability: "growth.recommend",
  jobTypes: ["growth.recommend"],
  ollamaModel: null, // configuration, set at activation
  pollSeconds: 10,
  leaseSeconds: 300,
  ollamaTimeoutMs: 180000,
  maxQualityAttempts: 3,
  tools: [],
  async run(_runtime, _job) {
    throw new Error("Growth Agent is not activated in V1.");
  },
};
