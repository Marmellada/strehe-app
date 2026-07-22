# Inspection Lab Task Queue

## Rules
- Work top to bottom unless the user explicitly changes priority.
- Only one task should be IN_PROGRESS.
- When a task is completed, mark it DONE.
- Then move the next TODO task into CURRENT_TASK.md.
- If blocked, mark BLOCKED and explain why in HANDOFF.md.
- Do not skip tasks silently.

## Status values
TODO | IN_PROGRESS | DONE | BLOCKED

## Tasks

### T001 — Local E2E runner baseline
Status: DONE
Goal: Create local-only E2E runner that generates side_by_side, grid overlay, zone crops, prompts, review_result.json, and run_manifest.json.
Acceptance:
- dry run works
- verifier passes
- no production integration

### T002 — Normalizer repeatable tests
Status: DONE
Goal: Add repeatable raw-output test fixtures for JSON extraction, validation, and safe visual_check normalization.
Acceptance:
- valid raw model output passes
- raw output with text before JSON passes
- bad enum is flagged
- empty evidence is flagged
- NOT_VISIBLE never becomes MISSING
- dry-run/verifier still passes

### T003 — Merge full-room and zone checks
Status: DONE
Goal: Merge full-room visual checks with zone crop visual checks into draft findings.
Acceptance:
- zone crop can clarify or override unclear full-room result
- conflicts are flagged for review
- all findings remain review_required=true
- unchanged checks do not create draft findings by default

### T003.5 — Verification orchestrator and combined report
Status: DONE
Goal: Add a sequential verification orchestrator that writes per-verifier summaries and one combined report.
Acceptance:
- runs local verifiers sequentially
- writes verifier_summary.json for each executed verifier
- writes combined-verification-report.json even on failure
- stops on first failure
- keeps T004 as the next task

### T004 — Optional LM Studio/Qwen local model call
Status: DONE
Goal: Add optional local model execution only when env/config is present.
Acceptance:
- dry-run still works without a model
- model call saves raw output
- failures are recorded without crashing the whole run
- model config is visible in run_manifest.json

### T005 — GLM second-opinion config only
Status: DONE
Goal: Represent hard-case second-opinion routing in config/manifest only. Do not implement production routing.
Acceptance:
- unclear/conflict cases are marked second_opinion_recommended=true
- no external API call required
- no production routing is added

### T006 — Human review draft report shape
Status: DONE
Goal: Improve review_result.json so it is clearly usable by a future human review UI.
Acceptance:
- draft_findings include safe labels only
- evidence is short and review-friendly
- each finding links back to generated image/crop path if available
- review_required remains true

### T007 — Production integration planning only
Status: DONE
Goal: Create a short integration plan for how the local runner will later connect to STREHË Inspection Lab.
Acceptance:
- no code changes to production routes
- no Supabase migrations
- plan lists tables/jobs/storage boundaries
- plan keeps local worker polling architecture

### T008 — Single-case Ollama benchmark on GMKtec
Status: DONE
Goal: Run one existing synthetic comparison case through the local engine with Qwen3-VL 4B and record runtime, stability, and normalized-result quality.
Acceptance:
- only one case is run
- no production integration or database writes
- generated result is inspected without treating raw model output as final truth
- hardware/runtime limitations are documented

### T009 — Contain legacy worker service-role credential
Status: DONE
Goal: Remove the hard-coded privileged credential from the legacy Inspection Lab poller and require local environment configuration.
Acceptance:
- no privileged credential literal remains in the active worker
- `SUPABASE_SERVICE_ROLE_KEY` is loaded from the process environment or root `.env.local`
- missing or empty configuration stops before Supabase client creation or polling
- active and migration-backup trees are scanned locally without exposing credential values

### T010 — Migrate mobile client to Expo publishable-key configuration
Status: DONE
Goal: Remove the legacy public JWT from the mobile source and require Expo public environment configuration.
Acceptance:
- no Supabase credential or project URL literal remains in the mobile source
- the client reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- missing configuration and non-publishable key shapes fail before client creation
- a placeholder-only mobile `.env.example` is committable while real mobile `.env` files stay ignored
- active source scan contains no real privileged credential

## Queue Status
Complete. All listed Inspection Lab tasks are DONE.
