-- 1) Rename misleading property contact columns
ALTER TABLE public.properties
  RENAME COLUMN property_contact_name TO property_contact_name;

ALTER TABLE public.properties
  RENAME COLUMN property_contact_email TO property_contact_email;

ALTER TABLE public.properties
  RENAME COLUMN property_contact_phone TO property_contact_phone;


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