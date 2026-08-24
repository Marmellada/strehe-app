import { recordLlmUsage } from "../ledger.mjs";

function apiUrl(baseUrl, protocol) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  if (protocol === "openai_chat_completions") {
    return `${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`;
  }
  if (protocol === "anthropic_messages") {
    return `${base.replace(/\/v1$/, "")}/v1/messages`;
  }
  throw new Error(`unsupported OpenCode protocol: ${protocol}`);
}

function requestFor(protocol, model, prompt, temperature, maxTokens) {
  if (protocol === "openai_chat_completions") {
    return {
      model,
      stream: false,
      temperature,
      messages: [{ role: "user", content: prompt }],
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    };
  }
  if (protocol === "anthropic_messages") {
    return {
      model,
      stream: false,
      temperature,
      max_tokens: maxTokens || 4096,
      messages: [{ role: "user", content: prompt }],
    };
  }
  throw new Error(`unsupported OpenCode protocol: ${protocol}`);
}

function responseContent(protocol, payload) {
  if (protocol === "openai_chat_completions") {
    return payload?.choices?.[0]?.message?.content ?? "";
  }
  if (protocol === "anthropic_messages") {
    return Array.isArray(payload?.content)
      ? payload.content.filter((item) => item?.type === "text").map((item) => item.text || "").join("")
      : "";
  }
  return "";
}

export function normalizeOpenCodeUsage(protocol, payload) {
  const usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : {};
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? null;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? null;
  const cacheReadTokens = usage.cache_read_tokens
    ?? usage.cache_read_input_tokens
    ?? usage.prompt_tokens_details?.cached_tokens
    ?? null;
  const cacheWriteTokens = usage.cache_write_tokens ?? usage.cache_creation_input_tokens ?? null;
  const reasoningTokens = usage.reasoning_tokens
    ?? usage.completion_tokens_details?.reasoning_tokens
    ?? null;
  return {
    protocol,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    estimatedCostUsd: payload?.estimated_cost_usd ?? usage.estimated_cost_usd ?? null,
    costStatus: payload?.cost_status ?? usage.cost_status ?? "unknown",
  };
}

function estimatedCost(usage, rate) {
  const providerCost = Number(usage.estimatedCostUsd);
  if (Number.isFinite(providerCost) && providerCost > 0) {
    return { value: providerCost, status: usage.costStatus || "reported" };
  }
  const inputRate = Number(rate?.input);
  const outputRate = Number(rate?.output);
  if (Number.isFinite(inputRate) && Number.isFinite(outputRate)) {
    const input = Number(usage.inputTokens) || 0;
    const output = Number(usage.outputTokens) || 0;
    return { value: ((input * inputRate) + (output * outputRate)) / 1000000, status: "estimated" };
  }
  return { value: Number.isFinite(providerCost) ? providerCost : null, status: usage.costStatus || "unknown" };
}

function classifyFetchError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "network_timeout";
  return "provider_network_error";
}

export function createOpenCodeAdapter({
  apiKey,
  baseUrl,
  model,
  protocol,
  db,
  ratecard,
  timeoutMs = 120000,
  fetchImpl = globalThis.fetch,
}) {
  if (!apiKey) throw new Error("Missing OPENCODE_GO_API_KEY in the router environment.");
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");
  const endpoint = apiUrl(baseUrl, protocol);
  let context = {};

  function writeUsage(usage, durationMs) {
    const cost = estimatedCost(usage, ratecard);
    recordLlmUsage(db, {
      provider: "opencode",
      model,
      ...context,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      reasoningTokens: usage.reasoningTokens,
      apiCalls: 1,
      estimatedCostUsd: cost.value,
      costStatus: cost.status,
      durationMs,
    });
  }

  return {
    provider: "opencode",
    model,
    protocol,
    isExternal: true,
    setContext(next) {
      context = next && typeof next === "object" ? { ...next } : {};
    },
    async chat({ prompt, temperature = 0.1, maxTokens } = {}) {
      const started = Date.now();
      let recorded = false;
      try {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        };
        if (protocol === "anthropic_messages") {
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
        }
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestFor(protocol, model, String(prompt || ""), temperature, maxTokens)),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await response.text();
        let payload = {};
        try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
        const usage = normalizeOpenCodeUsage(protocol, payload);
        writeUsage(usage, Date.now() - started);
        recorded = true;
        if (!response.ok) {
          const error = new Error(`OpenCode returned ${response.status}: ${text.slice(0, 1000)}`);
          error.code = /context[_ -]?length|maximum context|too many (input )?tokens/i.test(text)
            ? "context_length"
            : response.status === 429
              ? "rate_limited"
              : response.status >= 500
                ? "provider_5xx"
                : "provider_request_failed";
          throw error;
        }
        return responseContent(protocol, payload);
      } catch (error) {
        if (!recorded) {
          writeUsage({}, Date.now() - started);
          recorded = true;
        }
        if (!error.code) error.code = classifyFetchError(error);
        throw error;
      }
    },
  };
}
