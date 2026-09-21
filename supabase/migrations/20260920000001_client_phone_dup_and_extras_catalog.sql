-- Allow duplicate phone numbers among active customers (client request).
-- Keep uniqueness on email / DUI / NIT.
DROP INDEX IF EXISTS public.uq_customers_phone_active;

-- Ensure OLDES recurring extras exist in quote catalog (idempotent by code).
INSERT INTO public.quote_catalog_items (
  code, name_es, name_en, description_es, description_en,
  item_type, unit_price, tax_rate, sort_order, is_active
)
SELECT v.code, v.name_es, v.name_en, v.description_es, v.description_en,
       v.item_type, v.unit_price, v.tax_rate, v.sort_order, true
FROM (VALUES
  ('CHILD_SEAT', 'Silla de bebé', 'Baby seat',
   'Silla infantil por unidad / día según acuerdo.', 'Child/baby seat.',
   'SERVICE', 5.00, 0.13, 30),
  ('DRIVER', 'Motorista', 'Driver',
   'Servicio de motorista.', 'Driver service.',
   'SERVICE', 35.00, 0.13, 50),
  ('DELIVERY', 'Entrega fuera de horas laborales', 'After-hours delivery',
   'Cargo por entrega o devolución fuera de horario.', 'After-hours delivery/return.',
   'SERVICE', 25.00, 0.13, 10),
  ('FUEL', 'Cobro de combustible', 'Fuel charge',
   'Cargo por combustible faltante o prepago.', 'Fuel charge.',
   'SERVICE', 20.00, 0.13, 60),
  ('INTL_INSURANCE', 'Seguro internacional', 'International insurance',
   'Seguro por día fuera del país.', 'International insurance per day.',
   'SERVICE', 15.00, 0.13, 70),
  ('EXIT_PERMIT', 'Permiso de salida del país', 'Exit permit',
   'Permiso notarial de salida (costo efectivo).', 'Notarial exit permit.',
   'SERVICE', 75.00, 0.13, 80),
  ('GPS', 'GPS / navegación', 'GPS navigation',
   'Unidad GPS.', 'GPS unit.',
   'SERVICE', 5.00, 0.13, 40),
  ('AIRPORT', 'Recogida/entrega aeropuerto', 'Airport pickup/drop-off',
   'Servicio aeropuerto.', 'Airport service.',
   'SERVICE', 0.00, 0.13, 20)
) AS v(code, name_es, name_en, description_es, description_en, item_type, unit_price, tax_rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.quote_catalog_items c WHERE c.code = v.code AND c.deleted_at IS NULL
);

COMMENT ON COLUMN public.reservations.extra_line_items IS
  'Named billable extras [{label, quantity?, unitPrice?, amount}]. Sum should match additional_costs.';

COMMENT ON COLUMN public.contracts.extra_line_items IS
  'Named billable extras [{label, quantity?, unitPrice?, amount}].';
