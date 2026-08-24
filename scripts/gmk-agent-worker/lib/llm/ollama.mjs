// Model-agnostic local Ollama adapter. Loopback-only by construction.

export const OLLAMA_CONTEXT_EXCEEDED_PATTERN = /prompt is longer than the context length|context[_ -]?length exceeded|maximum context length|too many (input )?tokens/i;

export function isContextLengthError(text) {
  return OLLAMA_CONTEXT_EXCEEDED_PATTERN.test(String(text || ""));
}

export function ensureLocalOllamaUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("OLLAMA_BASE_URL must point to this PC. Public AI APIs are disabled.");
  }
  return url.toString().replace(/\/$/, "");
}

export async function ollamaChat({
  baseUrl,
  model,
  prompt,
  images,
  temperature = 0.1,
  numCtx = 8192,
  numGpu = 0,
  timeoutMs = 180000,
}) {
  const base = ensureLocalOllamaUrl(baseUrl);
  const message = { role: "user", content: prompt };
  if (images && images.length) message.images = images;

  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: "json",
      messages: [message],
      options: { temperature, num_ctx: numCtx, num_gpu: numGpu },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Ollama returned ${response.status}: ${body}`);
    if (isContextLengthError(body)) error.code = "ollama_context_exceeded";
    throw error;
  }
  const payload = await response.json();
  return payload?.message?.content ?? "";
}

export function createOllamaAdapter(config) {
  return {
    provider: "ollama",
    model: config.model,
    protocol: "ollama_chat",
    isExternal: false,
    setContext() {},
    chat(options) {
      return ollamaChat({
        baseUrl: config.baseUrl,
        model: config.model,
        numGpu: config.numGpu,
        timeoutMs: config.timeoutMs,
        ...options,
      });
    },
  };
}
