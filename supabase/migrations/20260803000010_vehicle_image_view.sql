-- Vista del vehículo asociada a cada foto (para contratos e inspección 3D).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'vehicle_image_view'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.vehicle_image_view AS ENUM (
      'TOP',
      'FRONT',
      'REAR',
      'LEFT',
      'RIGHT'
    );
  END IF;
END $$;

ALTER TABLE public.vehicle_images
  ADD COLUMN IF NOT EXISTS view public.vehicle_image_view;

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_view
  ON public.vehicle_images (vehicle_id, view);
