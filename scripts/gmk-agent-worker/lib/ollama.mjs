// Model-agnostic local Ollama adapter. Loopback-only by construction.

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
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  return payload?.message?.content ?? "";
}
