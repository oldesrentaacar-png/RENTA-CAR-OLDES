-- Tarifas diarias con más de 2 decimales (ej. 435/7 = 62.142857).
-- Los montos (total, abonos, depósitos) siguen en numeric(12,2).
-- Hay que recrear vistas públicas que dependen de daily_rate.

DROP VIEW IF EXISTS public.public_vehicles;
DROP VIEW IF EXISTS public.public_vehicle_types;

ALTER TABLE public.reservations
  ALTER COLUMN agreed_rate TYPE numeric(12, 6)
  USING round(agreed_rate::numeric, 6);

ALTER TABLE public.contracts
  ALTER COLUMN agreed_rate TYPE numeric(12, 6)
  USING round(agreed_rate::numeric, 6);

ALTER TABLE public.quotes
  ALTER COLUMN daily_rate TYPE numeric(12, 6)
  USING round(daily_rate::numeric, 6);

ALTER TABLE public.quote_items
  ALTER COLUMN unit_price TYPE numeric(12, 6)
  USING round(unit_price::numeric, 6);

ALTER TABLE public.vehicles
  ALTER COLUMN daily_rate TYPE numeric(12, 6)
  USING round(daily_rate::numeric, 6);

ALTER TABLE public.vehicle_types
  ALTER COLUMN daily_rate TYPE numeric(12, 6)
  USING round(daily_rate::numeric, 6);

CREATE OR REPLACE VIEW public.public_vehicles AS
SELECT
  id,
  slug,
  brand,
  model,
  year,
  category,
  transmission,
  passengers,
  luggage,
  air_conditioning,
  daily_rate,
  public_description
FROM public.vehicles v
WHERE published_on_web = true
  AND is_active = true
  AND deleted_at IS NULL
  AND archived_at IS NULL
  AND status <> ALL (ARRAY['ARCHIVED'::public.vehicle_status, 'UNAVAILABLE'::public.vehicle_status]);

CREATE OR REPLACE VIEW public.public_vehicle_types AS
SELECT
  id,
  slug,
  name,
  name_en,
  description,
  description_en,
  reference_models,
  reference_models_en,
  daily_rate,
  weekly_rate,
  passengers,
  luggage,
  luggage_label,
  luggage_label_en,
  doors,
  air_conditioning,
  transmission,
  features,
  image_url,
  sort_order
FROM public.vehicle_types vt
WHERE published_on_web = true
  AND is_active = true
  AND deleted_at IS NULL;

GRANT SELECT ON public.public_vehicles TO anon, authenticated;
GRANT SELECT ON public.public_vehicle_types TO anon, authenticated;

COMMENT ON VIEW public.public_vehicles IS
  'Catálogo público de vehículos publicados (Landing).';
