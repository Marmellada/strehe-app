function finiteInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function recordLlmUsage(db, entry) {
  const usage = {
    provider: String(entry.provider || "unknown"),
    model: String(entry.model || "unknown"),
    jobId: entry.jobId ? String(entry.jobId) : null,
    runId: entry.runId ? String(entry.runId) : null,
    agentKey: entry.agentKey ? String(entry.agentKey) : null,
    taskType: entry.taskType ? String(entry.taskType) : null,
    inputTokens: finiteInteger(entry.inputTokens),
    outputTokens: finiteInteger(entry.outputTokens),
    cacheReadTokens: finiteInteger(entry.cacheReadTokens),
    cacheWriteTokens: finiteInteger(entry.cacheWriteTokens),
    reasoningTokens: finiteInteger(entry.reasoningTokens),
    apiCalls: finiteInteger(entry.apiCalls) ?? 1,
    estimatedCostUsd: finiteNumber(entry.estimatedCostUsd),
    costStatus: String(entry.costStatus || "unknown"),
    durationMs: finiteInteger(entry.durationMs),
  };
  const info = db.prepare(
    `INSERT INTO llm_usage_ledger
      (provider, model, job_id, run_id, agent_key, task_type, input_tokens,
       output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
       api_calls, estimated_cost_usd, cost_status, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    usage.provider, usage.model, usage.jobId, usage.runId, usage.agentKey,
    usage.taskType, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens,
    usage.cacheWriteTokens, usage.reasoningTokens, usage.apiCalls,
    usage.estimatedCostUsd, usage.costStatus, usage.durationMs,
  );
  return Number(info.lastInsertRowid);
}

export function recordRoutingOutcome(db, entry) {
  const info = db.prepare(
    `INSERT INTO routing_outcomes
      (job_type, scope_fingerprint, model, outcome, failure_class)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    String(entry.jobType),
    entry.scopeFingerprint ? String(entry.scopeFingerprint) : null,
    String(entry.model),
    String(entry.outcome),
    entry.failureClass ? String(entry.failureClass) : null,
  );
  return Number(info.lastInsertRowid);
}

export function recordCoordinatorEvent(db, event, detail = {}) {
  const info = db.prepare(
    "INSERT INTO coordinator_events (event, detail_json) VALUES (?, ?)",
  ).run(String(event), JSON.stringify(detail));
  return Number(info.lastInsertRowid);
}

export function recordJobLifecycle(db, entry) {
  const handle = entry.modelHandle == null
    ? null
    : typeof entry.modelHandle === "string"
      ? entry.modelHandle
      : JSON.stringify(entry.modelHandle);
  const info = db.prepare(
    `INSERT INTO job_lifecycle_log
      (job_id, state, model_handle, iteration_count, deadline_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    String(entry.jobId),
    String(entry.state),
    handle,
    finiteInteger(entry.iterationCount) ?? 0,
    entry.deadlineAt ? String(entry.deadlineAt) : null,
  );
  return Number(info.lastInsertRowid);
}
