import { runCodexTask } from "../codex-runner.mjs";

export function createCodexAdapter(options = {}) {
  return {
    provider: "codex",
    model: "codex-cli",
    async execute(input) {
      return runCodexTask({ ...options, ...input });
    },
  };
}
