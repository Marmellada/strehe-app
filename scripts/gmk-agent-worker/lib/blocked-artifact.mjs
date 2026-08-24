import fs from "node:fs";
import path from "node:path";

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
}

function safeText(value, max = 4000) {
  return String(value ?? "unknown").replace(/[\u0000-\u001f]/g, " ").slice(0, max);
}

export function writeBlockedArtifact(runtimeRoot, {
  reason,
  pendingJobs = [],
  attempted = [],
  resumeCommand = "node scripts/gmk-agent-worker/coordinator.mjs --once",
  date = new Date(),
} = {}) {
  const artifactDir = path.join(runtimeRoot, "state", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  const baseName = `BLOCKED-${stamp(date)}`;
  let filePath = path.join(artifactDir, `${baseName}.md`);
  for (let suffix = 2; fs.existsSync(filePath); suffix += 1) {
    filePath = path.join(artifactDir, `${baseName}-${suffix}.md`);
  }
  const content = [
    "# STREHE Router BLOCKED",
    "",
    `- Time: ${date.toISOString()}`,
    `- Reason: ${safeText(reason)}`,
    `- Pending jobs: ${pendingJobs.length ? pendingJobs.map((job) => safeText(job.id || job)).join(", ") : "none recorded"}`,
    `- Attempted: ${attempted.length ? attempted.map((item) => safeText(item)).join("; ") : "none"}`,
    "- Health: not evaluated in P0-P2 (P3)",
    "- Budget: configured/ledgered but not enforced in P0-P2 (P3)",
    "",
    "Resume:",
    "```powershell",
    safeText(resumeCommand),
    "```",
    "",
  ].join("\n");
  fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
  return filePath;
}
