# Session Handoff — Inspection Lab Mobile Setup

## 2026-07-22 — Mobile publishable-key migration and containment commit

### What was inspected
- Existing worker containment changes and required Inspection Lab handoff files.
- Mobile Supabase client configuration, mobile documentation, environment examples, and root ignore rules.
- Active source tree through a sanitized, offline credential scan.

### What changed
- Removed the embedded mobile public JWT and project URL.
- Added `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configuration with fail-closed validation.
- Added a placeholder-only mobile `.env.example` and preserved ignore coverage for real mobile `.env` files.
- Updated setup and handoff documentation without adding credential values.

### Current risks found
- The migration backup still contains historical credential copies and remains unchanged.
- The mobile app must never receive a server-side secret through an Expo public variable.
- The worker retains two pre-existing unused-variable lint warnings that are unrelated to credential handling.

### What has not been changed
- No worker, mobile app, migration, Supabase command, authenticated test, or external request was run.
- No migration-backup file was modified.
- No unrelated Inspection Lab implementation was staged for the containment commit.

### Next exact step
Keep future migration-backup sanitization in a separate, explicitly scoped task.

## 2026-07-22 — Legacy worker credential containment

### What was inspected
- `inspection-lab/scripts/worker-poll.mjs` startup and Supabase client configuration.
- Root and Inspection Lab environment-loading conventions.
- Active repository and migration-backup textual files, including ignored and untracked files, with dependency trees and binaries excluded.

### What changed
- Removed the hard-coded Supabase service-role credential from the active legacy poller.
- Added root `.env.local` loading and required `SUPABASE_SERVICE_ROLE_KEY` validation before client creation.
- Updated Inspection Lab task and handoff notes. The migration backup was not modified.

### Current risks found
- The exposed credential must still be rotated manually; local code containment does not revoke it.
- The migration backup retains historical real credential copies.
- The root `.env.local` retains the configured service-role credential as an ignored local secret.
- Inspection Lab-wide lint has unrelated pre-existing mobile-screen hook errors.

### What has not been changed yet
- No credential was rotated or sent to any external service.
- No worker was started, no polling occurred, and no Supabase client request was made.
- No migration-backup file was modified.

### Next exact step
Rotate the Supabase service-role credential outside this offline task, then replace only the `SUPABASE_SERVICE_ROLE_KEY` value in the active root `.env.local`.

## 2026-07-21 — GMKtec single-case Ollama benchmark

### What was inspected
- Existing real-sample and synthetic comparison packs.
- Installed Ollama vision models and the local runner's OpenAI-compatible model path.
- Normalized output for synthetic case `02_remote_removed` using `qwen3-vl:4b`.

### What changed
- No engine source code changed.
- Playwright Chromium was installed at `D:\Personal\Tools\ms-playwright`.
- Ollama model `qwen3-vl:4b` was installed in the existing D-drive model store.
- Generated benchmark artifacts were written under `inspection-lab/e2e-runs/02_remote_removed/`.

### Current risks found
- CPU-only inference required about 23 minutes 52 seconds for six passes.
- Three of six model calls lost their Ollama connection.
- The result detected the intended remote change but retained duplicate and mislocalized drafts.
- Concurrent Ollama vision sessions can destabilize the runner.
- The declared real-sample photos are not present; only the synthetic pack is currently runnable.

### What has not been changed yet
- No standalone app has been implemented.
- No production route, Supabase, billing, auth, or mobile code was changed.
- No duplicate-finding or retry behavior was modified.

### Next exact step
Create a new scoped task for the standalone local tester, preserving the existing engine and adding single-run locking, progress reporting, cancellation, and partial-result display.

Date: 2026-06-28
Session: Xiaomi 11T first real device test

## What was inspected
- Full mobile app codebase under inspection-lab/mobile-app/
- All 18 JS source files across src/screens, src/navigation, src/storage, src/utils
- App.js entry point, app.json config, package.json dependencies
- AGENTS.md (updated in this session)

## Current risks found
1. CheckinScreen.js imports `getPhotos` and `savePhoto` from database.js — these functions do NOT exist.
   - Impact: Runtime ReferenceError if ever navigated to.
   - Mitigation: Not currently in AppNavigator, but the file has broken code.
2. InspectionCaptureScreen.js imports `getPhotos`, `saveInspectionPhoto`, `updateInspectionStatus` from database.js — `saveInspectionPhoto` and `updateInspectionStatus` do NOT exist.
   - Impact: Runtime ReferenceError if ever navigated to.
   - Mitigation: Not currently in AppNavigator, but the file has broken code.
3. Supabase credentials hardcoded in supabase.js.
   - Impact: Anon key exposed in client bundle. Acceptable for local-only dev, but must not go to production.
   - Mitigation: No action for this session (out of scope).
4. InspectionDetailScreen.handleLocalExport() is a placeholder alert — needs wiring to exportZonesForEngine.
   - Impact: User cannot export inspection data locally.
   - Mitigation: Can be tested manually after Checkpoint 1.

## Current approved checkpoint
Checkpoint 1 only:
- Read database.js exports.
- Read all screens importing from database.js.
- Fix broken imports/usages in CheckinScreen.js, InspectionCaptureScreen.js, and any other affected file.
- Do not delete files, redesign, change architecture, build APK, or broadly disable Supabase.

## What has not been changed yet
- No files modified in this session so far.
- AGENTS.md being written now.
- SESSION_HANDOFF.md being written now.

## Next exact step after this file creation
Implement Checkpoint 1: fix broken imports in CheckinScreen.js and InspectionCaptureScreen.js.
Then stop and report per the approved spec.

## Next manual step for Milot (after Checkpoint 1 report)
Run the exact Windows command to verify ADB connectivity before Expo Go test:
  adb devices
