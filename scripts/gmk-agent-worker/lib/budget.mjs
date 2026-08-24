import { getState, setState } from "./sqlite.mjs";
import { recordCoordinatorEvent, usageMeteringHoldStateKey } from "./ledger.mjs";

export const BUDGET_WINDOWS = Object.freeze({
  rolling_5h: { milliseconds: 5 * 60 * 60 * 1000, sqliteModifier: "-5 hours" },
  rolling_7d: { milliseconds: 7 * 24 * 60 * 60 * 1000, sqliteModifier: "-7 days" },
  rolling_30d: { milliseconds: 30 * 24 * 60 * 60 * 1000, sqliteModifier: "-30 days" },
});

export function budgetPauseStateKey(provider) {
  return `budget_${String(provider).replace(/[^a-z0-9_]/gi, "_")}_paused_until`;
}

export function budgetMeteringHoldStateKey(provider) {
  return usageMeteringHoldStateKey(provider);
}

function percentage(used, limit) {
  return Number.isFinite(Number(limit)) && Number(limit) > 0 ? (Number(used) / Number(limit)) * 100 : 0;
}

export function readBudgetWindows(db, provider, providerConfig, now = new Date()) {
  const result = {};
  for (const [name, window] of Object.entries(BUDGET_WINDOWS)) {
    const limit = providerConfig?.[name];
    if (!limit) throw new Error(`missing budget window ${provider}.${name}`);
    const row = db.prepare(
      `SELECT
         COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) AS tokens,
         COALESCE(SUM(CASE
           WHEN reported_cost_usd IS NOT NULL THEN reported_cost_usd
           WHEN lower(cost_status) IN ('reported', 'exact') THEN COALESCE(estimated_cost_usd, 0)
           ELSE 0 END), 0) AS reported_usd,
         COALESCE(SUM(CASE
           WHEN reported_cost_usd IS NULL AND lower(cost_status) = 'estimated'
             THEN COALESCE(estimated_cost_usd, 0)
           ELSE 0 END), 0) AS estimated_usd,
         SUM(CASE WHEN lower(cost_status) = 'unknown' THEN 1 ELSE 0 END) AS unknown_cost_calls,
         SUM(CASE
           WHEN lower(cost_status) = 'unknown'
             AND (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) <= 0
           THEN 1 ELSE 0 END) AS unknown_unmetered_calls,
         COALESCE(SUM(api_calls), 0) AS calls
       FROM llm_usage_ledger
       WHERE provider = ? AND julianday(created_at) >= julianday(?, ?)`,
    ).get(provider, now.toISOString(), window.sqliteModifier);
    const tokens = Number(row.tokens || 0);
    const reportedUsd = Number(row.reported_usd || 0);
    const estimatedUsd = Number(row.estimated_usd || 0);
    const tokenPercent = percentage(tokens, limit.max_tokens);
    const usdPercent = percentage(reportedUsd + estimatedUsd, limit.max_usd_estimate);
    const runPercent = percentage(Number(row.calls || 0), limit.max_runs);
    result[name] = {
      tokens,
      reported_usd: reportedUsd,
      estimated_usd: estimatedUsd,
      unknown_cost_calls: Number(row.unknown_cost_calls || 0),
      unknown_unmetered_calls: Number(row.unknown_unmetered_calls || 0),
      calls: Number(row.calls || 0),
      token_percent: tokenPercent,
      usd_percent: usdPercent,
      run_percent: runPercent,
      percent: Math.max(tokenPercent, usdPercent, runPercent),
      limits: { ...limit },
    };
  }
  return result;
}

function allBelow(windows, threshold) {
  return Object.values(windows).every((window) => window.percent < threshold);
}

export function evaluateBudget({ db, provider, budgetConfig, job, route, now = new Date() }) {
  try {
    const providerConfig = budgetConfig?.[provider];
    if (!providerConfig) throw new Error(`missing budget configuration for provider ${provider}`);
    const windows = readBudgetWindows(db, provider, providerConfig, now);
    const softThreshold = Number(budgetConfig.soft_threshold_pct);
    const hardThreshold = Number(budgetConfig.hard_threshold_pct);
    if (!Number.isFinite(softThreshold) || !Number.isFinite(hardThreshold)) {
      throw new Error("budget thresholds are invalid");
    }
    const pauseKey = budgetPauseStateKey(provider);
    const meteringHoldKey = budgetMeteringHoldStateKey(provider);
    const unmeteredWindows = Object.entries(windows)
      .filter(([, window]) => window.unknown_unmetered_calls > 0)
      .map(([name]) => name);
    if (unmeteredWindows.length) {
      const detail = JSON.stringify({ detected_at: now.toISOString(), windows: unmeteredWindows });
      setState(db, meteringHoldKey, detail);
      recordCoordinatorEvent(db, "budget_metering_fault", { provider, windows });
      return { allowed: false, reason: "budget_metering_fault", provider, windows };
    }
    if (getState(db, meteringHoldKey)) {
      db.prepare("DELETE FROM runtime_state WHERE key = ?").run(meteringHoldKey);
      recordCoordinatorEvent(db, "budget_metering_restored", { provider, windows });
    }
    const existingPause = getState(db, pauseKey);
    if (existingPause && allBelow(windows, softThreshold)) {
      db.prepare("DELETE FROM runtime_state WHERE key = ?").run(pauseKey);
      recordCoordinatorEvent(db, "budget_resumed", { provider, windows });
    }
    const hard = Object.values(windows).some((window) => window.percent >= hardThreshold);
    if (hard) {
      const pausedUntil = new Date(now.getTime() + BUDGET_WINDOWS.rolling_30d.milliseconds).toISOString();
      setState(db, pauseKey, pausedUntil);
      recordCoordinatorEvent(db, "budget_hard", { provider, paused_until: pausedUntil, windows });
      return { allowed: false, reason: "budget_hard", provider, pausedUntil, windows };
    }
    if (existingPause && !allBelow(windows, softThreshold)) {
      return { allowed: false, reason: "budget_paused", provider, pausedUntil: existingPause, windows };
    }
    const soft = Object.values(windows).some((window) => window.percent >= softThreshold);
    if (soft) {
      const lowPriority = Number(job?.priority ?? 100) >= 400;
      recordCoordinatorEvent(db, "budget_soft", {
        provider,
        job_id: job?.id || null,
        model_handle: route?.handle || null,
        dispatch_allowed: !lowPriority,
        windows,
      });
      return {
        allowed: !lowPriority,
        reason: lowPriority ? "budget_soft_low_priority" : "budget_soft",
        provider,
        costPressure: "soft",
        windows,
      };
    }
    return { allowed: true, reason: "budget_ok", provider, costPressure: "normal", windows };
  } catch (error) {
    return {
      allowed: false,
      reason: "budget_state_unavailable",
      provider,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    };
  }
}
