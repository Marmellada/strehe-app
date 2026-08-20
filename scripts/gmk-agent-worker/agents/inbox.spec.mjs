// Inbox Agent — V1 contract stub (disabled until activation).
// NOT provisioned and never enqueued in V1; this spec exists to define the shape.
// The Inbox Agent is READ/ANALYZE/PREPARE only and MUST NOT send customer messages.
export default {
  agentKey: "inbox.local",
  capability: "inbox.analyze",
  jobTypes: ["inbox.analyze"],
  ollamaModel: null, // model selection is configuration, set at provisioning time
  pollSeconds: 10,
  leaseSeconds: 300,
  ollamaTimeoutMs: 180000,
  maxQualityAttempts: 3,
  tools: [], // no tools; consumes context-in-payload, produces a draft
  async run(_runtime, _job) {
    throw new Error("Inbox Agent is not activated in V1.");
  },
};
