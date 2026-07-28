-- 1) Rename misleading property contact columns
-- The original migration contained three invalid self-renames. These columns
-- already have their intended property_contact_* names at this migration point,
-- so the no-op statements are removed to allow deterministic clean replay.
-- The original is preserved under the STREHE-LAUNCH-003 record with SHA-256
-- e2f7893b4a8cae5703fa2b227c6abde3a09fd0def191712ea07f0b2f19ff59bb.


-- 2) Remove duplicate constraints / indexes on keys and key_logs

-- Duplicate unique constraint / index on keys.key_code
ALTER TABLE public.keys
  DROP CONSTRAINT IF EXISTS keys_key_code_unique;

DROP INDEX IF EXISTS public.keys_key_code_unique;

-- Duplicate FK on keys.holder_user_id
ALTER TABLE public.keys
  DROP CONSTRAINT IF EXISTS keys_holder_user_id_fkey;

-- Duplicate FK on key_logs.performed_by_user_id
ALTER TABLE public.key_logs
  DROP CONSTRAINT IF EXISTS key_logs_performed_by_user_id_fkey;