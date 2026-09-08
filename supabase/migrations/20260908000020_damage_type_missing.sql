-- Add MISSING (faltante) for inspection damage marks (bumper plugs, covers, etc.).
DO $$
BEGIN
  ALTER TYPE public.damage_type ADD VALUE 'MISSING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
