import { openDatabase } from "../sqlite.mjs";
import { loadRouterConfig, loadRouterEnvironment, resolveModelConfig } from "../router/config.mjs";
import { createOllamaAdapter } from "./ollama.mjs";
import { createOpenCodeAdapter } from "./opencode.mjs";

export function createLlmRegistry({
  runtimeRoot,
  modelHandle,
  ollamaConfig,
  routerConfig,
  routerEnvironment,
  fetchImpl,
}) {
  if (!modelHandle) {
    return createOllamaAdapter({
      baseUrl: ollamaConfig.baseUrl,
      model: ollamaConfig.model,
      numGpu: ollamaConfig.numGpu,
      timeoutMs: ollamaConfig.timeoutMs,
    });
  }

  const loaded = routerConfig || loadRouterConfig(runtimeRoot);
  const resolved = resolveModelConfig(loaded.models, modelHandle);
  if (resolved.providerName === "opencode") {
    const env = routerEnvironment || loadRouterEnvironment(runtimeRoot);
    const { db } = openDatabase(runtimeRoot);
    const modelName = modelHandle.slice("opencode/".length);
    return createOpenCodeAdapter({
      apiKey: env.get("OPENCODE_GO_API_KEY") || env.get("OPENCODE_API_KEY"),
      baseUrl: env.get("OPENCODE_BASE_URL") || resolved.provider.base_url,
      model: modelName,
      protocol: resolved.model.protocol,
      db,
      ratecard: loaded.ratecard.per_million_tokens?.[modelHandle],
      fetchImpl,
    });
  }

  const error = new Error(`provider ${resolved.providerName} is not executable before its implementation phase`);
  error.code = "provider_not_implemented";
  throw error;
}
