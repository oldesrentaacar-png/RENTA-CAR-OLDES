-- Expand fuel_level enum to tank fractions (octavos) as used by OLDES
-- and add operator signature URL on profiles.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'fuel_level' AND n.nspname = 'public'
  ) THEN
    ALTER TYPE public.fuel_level ADD VALUE IF NOT EXISTS 'ONE_EIGHTH';
    ALTER TYPE public.fuel_level ADD VALUE IF NOT EXISTS 'THREE_EIGHTHS';
    ALTER TYPE public.fuel_level ADD VALUE IF NOT EXISTS 'FIVE_EIGHTHS';
    ALTER TYPE public.fuel_level ADD VALUE IF NOT EXISTS 'SEVEN_EIGHTHS';
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_url text;

COMMENT ON COLUMN public.profiles.signature_url IS
  'URL de firma digital del operador (Cloudinary/storage) para auto-relleno en entregas.';
