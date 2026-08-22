// Model-agnostic local Ollama adapter. Loopback-only by construction.

export const OLLAMA_CONTEXT_EXCEEDED_PATTERN = /prompt is longer than the context length/i;

// Deterministic classification: the request exceeded the model's current context
// window. Retrying the identical prompt cannot succeed, so this is not transient.
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

// Per-spec model; agents are roles, not models. format=json, no streaming, no
// chain-of-thought (think=false), bounded timeout.
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
      // num_gpu: 0 forces CPU-only. On this iGPU machine, GPU offload (CUDA/ROCm/
      // Vulkan) crashes llama-server with a C++ exception; CPU-only is the robust path.
      options: { temperature, num_ctx: numCtx, num_gpu: numGpu },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Ollama returned ${response.status}: ${body}`);
    // Deterministic context overflow: mark it so callers never retry the identical
    // oversized prompt (the request is unchanged, so the failure is unchanged).
    if (isContextLengthError(body)) error.code = "ollama_context_exceeded";
    throw error;
  }
  const payload = await response.json();
  return payload?.message?.content ?? "";
}
