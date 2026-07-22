# Inspection Lab Handoff

## Last completed
T008 — Single-case Ollama benchmark on GMKtec.

## Current known state
- Local E2E runner exists.
- Verifier exists.
- Verification orchestrator exists.
- Apartment fixture exists.
- Architecture v1.5 exists but should not be reread every task.
- Inspection Lab task queue is complete.

## Recent changes
- Removed the hard-coded legacy public JWT and project URL from `inspection-lab/mobile-app/src/storage/supabase.js`.
- The Expo client now requires `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, rejects every non-publishable key shape, and creates the client only after validation.
- Added a placeholder-only `inspection-lab/mobile-app/.env.example`; root ignore rules keep real mobile environment files ignored while allowing that example to be committed.
- Updated the mobile README and Supabase setup guide to keep server secrets out of `EXPO_PUBLIC_` configuration.
- Removed the hard-coded Supabase service-role credential from `inspection-lab/scripts/worker-poll.mjs`.
- The legacy poller now loads root `.env.local`, reads `SUPABASE_SERVICE_ROLE_KEY`, trims it, and throws a clear configuration error before client creation when it is missing or empty.
- Completed a sanitized, non-networked credential inventory of the active repository and the 2026-07-21 migration backup. The backup was not modified.
- Confirmed the migration backup still contains its historical hard-coded worker copy and ignored environment-file credential copies.
- Ran synthetic case `02_remote_removed` through the local engine with Ollama `qwen3-vl:4b` on the GMKtec.
- Installed the Playwright Chromium runtime under `D:\Personal\Tools\ms-playwright` and installed `qwen3-vl:4b` in the existing Ollama model store.
- The clean run completed in about 23 minutes 52 seconds and wrote its result under `inspection-lab/e2e-runs/02_remote_removed/2026-07-20T23-01-39-665Z/02_remote_removed/`.
- The expected remote-control change was detected, but the normalized result was partial: three model calls succeeded and three failed with connection loss.
- The result contained three NOT_VISIBLE drafts, including duplicates and one incorrectly associated with the dining area. Human review remained required.
- Fixed review-result assembly so local runs now include `normalized_status`, `partial_reasons`, and a safe `draft_summary` even when results are partial or empty.
- Narrowed the unsafe-wording scanner so safe phrases like "removed or altered" no longer trigger false positives, while still flagging stronger unsafe terms such as "evidence proves" and "proof of removal".
- Updated the no-model verifiers to assert the new summary/status fields and to cover a fixture that exercises the unsafe-wording scan.
- Verification passed without calling LM Studio:
  - `node inspection-lab/scripts/verify-local-e2e-inspection.mjs`
  - `node inspection-lab/scripts/verify-local-e2e-raw-output-normalization.mjs`
- Added `inspection-lab/scripts/verify-local-e2e-all.mjs`.
- The orchestrator writes per-verifier `verifier_summary.json` files and one `combined-verification-report.json` under `inspection-lab/e2e-runs/verification-runs/<timestamp>/`.
- The orchestrator runs verifiers sequentially and stops on first failure while still writing the combined report.
- Added optional local model execution to `inspection-lab/scripts/run-local-e2e-inspection.mjs`.
- The runner now writes model metadata into `run_manifest.json`, `review_result.json`, and raw-output sidecars when `INSPECTION_LAB_MODEL_ENABLED=true`.
- The default path remains offline/dry-run when no model env vars are set.
- Verified the model path with a local mock OpenAI-compatible endpoint.
- Added GLM second-opinion recommendation metadata to `inspection-lab/scripts/run-local-e2e-inspection.mjs` as config-only review metadata.
- The runner now writes `second_opinion` metadata into `run_manifest.json` and `review_result.json` without changing draft findings.
- The verifiers now assert the recommendation-only GLM metadata and machine-readable reasons.
- Added `human_review` metadata to `review_result.json` with a reviewer-facing queue derived from `draft_findings`.
- The human-review queue keeps safe wording, source links, and conservative default decisions.
- The verifiers now assert `human_review` exists, stays derived from `draft_findings`, and keeps second-opinion metadata in summary only.
- Latest combined report: `inspection-lab/e2e-runs/verification-runs/2026-06-25T17-43-34-449Z/combined-verification-report.json`
- Latest mock model run: `inspection-lab/e2e-runs/test-apartment-001/2026-06-25T17-44-00-395Z/`
- Latest verification run: `inspection-lab/e2e-runs/verification-runs/2026-06-25T17-59-00-590Z/combined-verification-report.json`
- Added `inspection-lab/PRODUCTION_INTEGRATION_PLAN.md` as a planning-only boundary document for future production integration.

## Tests run
- Static mobile configuration test — passed, including missing-variable guards, publishable-key shape enforcement, client-creation ordering, and placeholder-only example checks.
- Targeted ESLint for the worker and mobile Supabase module — passed with only the worker's two pre-existing unused-variable warnings.
- Sanitized active-source secret scan — passed with no real privileged credential in source; ignored local environment files were not printed or committed.
- `node --check inspection-lab/scripts/worker-poll.mjs` — passed.
- Missing-variable startup probe from an empty temporary working directory — passed and stopped before client creation/polling.
- Sanitized local credential scan across the active repository and migration backup — completed without network access.
- `npm run lint` — passed.
- `node_modules/.bin/tsc.cmd --noEmit` — passed.
- Targeted worker ESLint — passed with two pre-existing unused-variable warnings.
- `npm run lint:inspection-lab` — failed on pre-existing mobile-screen hook errors unrelated to the worker change.
- `node inspection-lab/scripts/verify-local-e2e-all.mjs`
- `node inspection-lab/scripts/run-local-e2e-inspection.mjs --setup inspection-lab/test-data/test-apartment-001/room_setup.json` with a local mock model endpoint and env-gated model config
- `node inspection-lab/scripts/verify-local-e2e-all.mjs` after adding second-opinion metadata and verifier checks
- `node inspection-lab/scripts/verify-local-e2e-all.mjs` after adding the human-review queue shape
- No production tests run; this was a documentation-only task.

## Known issues
- The mobile Expo configuration must remain limited to the public URL and publishable key; server secrets must never be copied into an `EXPO_PUBLIC_` variable.
- The historical migration backup retains a real hard-coded service-role credential in its untracked worker copy and real ignored environment credentials; it was intentionally left unchanged.
- Inspection Lab-wide lint has existing React hook/immutability errors in mobile screens. The modified worker itself has no lint errors.
- Ollama vision inference is CPU-only on this GMKtec and a six-pass Qwen3-VL 4B comparison took about 24 minutes.
- A stale concurrent Qwen3-VL 8B CLI session caused the first attempts to fail; model concurrency must be prevented in the standalone app.
- The current merge result can retain duplicate or mislocalized findings for the same object.
- The real-samples living-room folders currently contain only `.gitkeep`; the runnable 16-case pack is synthetic.
- Codex should not read the full architecture pack every session.
- Codex should not rediscover the whole repo every session.
- Run the local Inspection Lab verifiers through the orchestrator or sequentially. Parallel runs can collide in `inspection-lab/e2e-runs/`.

## Next recommended task
Separately sanitize or securely remove credential-bearing migration backups according to retention requirements. Keep that work isolated from application implementation changes.

## Blockers
None known.
