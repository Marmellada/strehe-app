# Supabase Migration Log

## Purpose

Use this file to record any Supabase migration or manual SQL change applied outside normal Git history.

Versioned SQL files live in `supabase/migrations`. If a migration is applied with `npx supabase db push`, or if SQL is run from the Supabase dashboard, record it here before deployment notes are finalized.

## Current Baseline

- Production launch context currently points to hosted app commit `1166c7a`.
- No dashboard-only SQL changes are recorded in this file yet.
- Latest versioned local migration currently present: `20260612110000_harden_agent_identity_boundary.sql`.

## Entries

| Date | Environment | Migration / SQL source | Applied by | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-06-19 | Production | Versioned migrations through local baseline | Codex handoff note | Build and tests pending in current launch pass | Keep this row updated if production migration state is confirmed from Supabase CLI or dashboard. |
