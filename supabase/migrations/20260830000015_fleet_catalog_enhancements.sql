-- Fleet catalog: reference models, luggage label, landing seed data

ALTER TABLE public.vehicle_types
  ADD COLUMN IF NOT EXISTS reference_models text,
  ADD COLUMN IF NOT EXISTS reference_models_en text,
  ADD COLUMN IF NOT EXISTS luggage_label text,
  ADD COLUMN IF NOT EXISTS luggage_label_en text;

CREATE OR REPLACE VIEW public.public_vehicle_types AS
SELECT
  vt.id,
  vt.slug,
  vt.name,
  vt.name_en,
  vt.description,
  vt.description_en,
  vt.reference_models,
  vt.reference_models_en,
  vt.daily_rate,
  vt.weekly_rate,
  vt.passengers,
  vt.luggage,
  vt.luggage_label,
  vt.luggage_label_en,
  vt.doors,
  vt.air_conditioning,
  vt.transmission,
  vt.features,
  vt.image_url,
  vt.sort_order
FROM public.vehicle_types vt
WHERE vt.published_on_web = true
  AND vt.is_active = true
  AND vt.deleted_at IS NULL;

-- Hide crossover category (not offered as standalone fleet card)
UPDATE public.vehicle_types
SET published_on_web = false, is_active = false
WHERE slug ILIKE '%crossover%';

INSERT INTO public.vehicle_types (
  slug, name, name_en, description, description_en,
  reference_models, reference_models_en,
  daily_rate, passengers, luggage, luggage_label, luggage_label_en,
  doors, air_conditioning, transmission, features,
  image_url, published_on_web, sort_order, is_active
) VALUES
  (
    'sedan', 'Sedán', 'Sedan',
    'Económico y ágil. Perfecto para la ciudad y trayectos diarios.',
    'Economical and agile. Perfect for city driving and daily trips.',
    'Nissan Sentra, Kia Soul o similar',
    'Nissan Sentra, Kia Soul or similar',
    32.00, 5, 2, NULL, NULL,
    4, true, 'Automatic', '["A/C","Seguro incluido"]'::jsonb,
    '/landing/fleet/sedan.png', true, 10, true
  ),
  (
    'suv-2-row', 'SUV 2 filas', '2 Row SUV',
    'Comodidad y altura ideal para explorar carreteras y playas.',
    'Comfort and ride height ideal for roads and beaches.',
    'Nissan Rogue, Jeep Compass o similar',
    'Nissan Rogue, Jeep Compass or similar',
    39.00, 5, 3, NULL, NULL,
    4, true, 'Automatic', '["A/C","Seguro incluido"]'::jsonb,
    '/landing/fleet/suv-2-row.png', true, 20, true
  ),
  (
    'suv-3-row', 'SUV 3 filas', '3 Row SUV',
    'Amplio espacio interior para familias o viajes en grupo.',
    'Spacious interior for families or group travel.',
    'Mitsubishi Outlander, Nissan Pathfinder o similar',
    'Mitsubishi Outlander, Nissan Pathfinder or similar',
    42.00, 7, 2, NULL, NULL,
    4, true, 'Automatic', '["A/C","Seguro incluido"]'::jsonb,
    '/landing/fleet/suv-3-row.png', true, 30, true
  ),
  (
    'minivan', 'Mini Van', 'Mini Van',
    'Máximo confort, espacio y equipaje para grupos grandes.',
    'Maximum comfort, space and luggage for large groups.',
    'Dodge Grand Caravan o similar',
    'Dodge Grand Caravan or similar',
    55.00, 7, 5, NULL, NULL,
    4, true, 'Automatic', '["A/C","Seguro incluido"]'::jsonb,
    '/landing/fleet/minivan.png', true, 40, true
  ),
  (
    'pickup', 'Pick Up', 'Pick Up',
    'Potencia y capacidad de carga para cualquier terreno.',
    'Power and cargo capacity for any terrain.',
    'Nissan NP300, Mitsubishi L200 o similar',
    'Nissan NP300, Mitsubishi L200 or similar',
    59.00, 5, 0,
    'Amplio espacio de carga abierta',
    'Large open cargo bed',
    4, true, 'Automatic', '["A/C","Palangana","Seguro incluido"]'::jsonb,
    '/landing/fleet/pickup.png', true, 50, true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  description_en = EXCLUDED.description_en,
  reference_models = EXCLUDED.reference_models,
  reference_models_en = EXCLUDED.reference_models_en,
  daily_rate = EXCLUDED.daily_rate,
  passengers = EXCLUDED.passengers,
  luggage = EXCLUDED.luggage,
  luggage_label = EXCLUDED.luggage_label,
  luggage_label_en = EXCLUDED.luggage_label_en,
  transmission = EXCLUDED.transmission,
  features = EXCLUDED.features,
  image_url = EXCLUDED.image_url,
  published_on_web = EXCLUDED.published_on_web,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  deleted_at = NULL,
  updated_at = now();
