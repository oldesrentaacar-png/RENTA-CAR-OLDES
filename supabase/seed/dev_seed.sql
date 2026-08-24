-- Rent A Car Pro — Development seed data
-- Run manually after migrations: psql or Supabase SQL editor
-- DO NOT run in production without review.
--
-- NOTE: This seed does NOT create auth.users or passwords.
-- To create staff accounts, use supabase/seed/create_first_admin.sql
-- or the Supabase Dashboard → Authentication → Users.

BEGIN;

-- ---------------------------------------------------------------------------
-- Sample customers
-- ---------------------------------------------------------------------------

INSERT INTO public.customers (
  id, first_name, last_name, identification, phone, whatsapp, email,
  license_number, license_expiry, address, country
) VALUES
  (
    'a1000001-0000-4000-8000-000000000001',
    'Carlos', 'Martínez', '01234567-8', '7777-1111', '7777-1111',
    'carlos.martinez@example.com', 'B1234567', '2027-06-15',
    'San Miguel', 'El Salvador'
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    'María', 'López', '87654321-0', '7777-2222', '7777-2222',
    'maria.lopez@example.com', 'B7654321', '2026-12-01',
    'San Salvador', 'El Salvador'
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    'José', 'Hernández', '11223344-5', '7777-3333', NULL,
    'jose.hernandez@example.com', 'B9988776', '2028-03-20',
    'Usulután', 'El Salvador'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample vehicles
-- ---------------------------------------------------------------------------

INSERT INTO public.vehicles (
  id, slug, category, brand, model, year, plate,
  ownership_type, status, published_on_web, is_active,
  transmission, fuel_type, passengers, doors, luggage, air_conditioning,
  daily_rate, weekly_rate, deposit, public_description
) VALUES
  (
    'b2000001-0000-4000-8000-000000000001',
    'toyota-corolla-2022', 'Sedán Económico', 'Toyota', 'Corolla', 2022, 'P123456',
    'OWN', 'AVAILABLE', true, true,
    'Automatic', 'Gasoline', 5, 4, 2, true,
    35.00, 210.00, 200.00,
    'Toyota Corolla 2022 — económico, confiable y perfecto para ciudad.'
  ),
  (
    'b2000001-0000-4000-8000-000000000002',
    'hyundai-tucson-2023', 'SUV', 'Hyundai', 'Tucson', 2023, 'P234567',
    'OWN', 'AVAILABLE', true, true,
    'Automatic', 'Gasoline', 5, 4, 4, true,
    55.00, 350.00, 300.00,
    'Hyundai Tucson 2023 — SUV espaciosa ideal para familia o carretera.'
  ),
  (
    'b2000001-0000-4000-8000-000000000003',
    'nissan-frontier-2021', 'Pickup', 'Nissan', 'Frontier', 2021, 'P345678',
    'THIRD_PARTY', 'AVAILABLE', false, true,
    'Manual', 'Diesel', 5, 4, 0, true,
    65.00, 400.00, 350.00,
    'Nissan Frontier — pickup para trabajo y carga ligera.'
  ),
  (
    'b2000001-0000-4000-8000-000000000004',
    'kia-rio-2020', 'Compacto', 'Kia', 'Rio', 2020, 'P456789',
    'OWN', 'MAINTENANCE', false, true,
    'Automatic', 'Gasoline', 5, 4, 1, true,
    28.00, 170.00, 150.00,
    'Kia Rio compacto — bajo consumo.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vehicle_images (vehicle_id, url, public_id, position, is_primary)
SELECT v.id, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', 'rentacar/demo/corolla-1', 0, true
FROM public.vehicles v WHERE v.slug = 'toyota-corolla-2022'
  AND NOT EXISTS (SELECT 1 FROM public.vehicle_images WHERE vehicle_id = v.id);

INSERT INTO public.vehicle_images (vehicle_id, url, public_id, position, is_primary)
SELECT v.id, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', 'rentacar/demo/tucson-1', 0, true
FROM public.vehicles v WHERE v.slug = 'hyundai-tucson-2023'
  AND NOT EXISTS (SELECT 1 FROM public.vehicle_images WHERE vehicle_id = v.id);

-- ---------------------------------------------------------------------------
-- Sample web requests (codes assigned by trigger if inserted via app;
-- for seed we set explicit codes)
-- ---------------------------------------------------------------------------

INSERT INTO public.document_sequences (doc_type, year, last_value) VALUES
  ('SOL', 2026, 3),
  ('COT', 2026, 2)
ON CONFLICT (doc_type, year) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, EXCLUDED.last_value);

INSERT INTO public.web_requests (
  code, first_name, last_name, phone, email,
  pickup_date, pickup_time, return_date, return_time,
  vehicle_id, vehicle_category, pickup_location, notes,
  source, status
) VALUES
  (
    'SOL-2026-000001', 'Pedro', 'García', '7777-4444', 'pedro@example.com',
    '2026-08-10', '09:00', '2026-08-15', '16:00',
    'b2000001-0000-4000-8000-000000000001', 'Sedán Económico',
    'Aeropuerto San Miguel', 'Entrega en aeropuerto',
    'WEBSITE', 'PENDING'
  ),
  (
    'SOL-2026-000002', 'Ana', 'Reyes', '7777-5555', 'ana@example.com',
    '2026-08-20', '10:00', '2026-08-22', '10:00',
    'b2000001-0000-4000-8000-000000000002', 'SUV',
    'Oficina San Miguel', NULL,
    'WEBSITE', 'CONTACTED'
  )
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sample quote
-- ---------------------------------------------------------------------------

INSERT INTO public.quotes (
  code, customer_id, vehicle_id, web_request_id, status,
  start_at, end_at, days, daily_rate, subtotal, insurance, deposit,
  delivery_fee, total, valid_until
) VALUES (
  'COT-2026-000001',
  'a1000001-0000-4000-8000-000000000001',
  'b2000001-0000-4000-8000-000000000001',
  (SELECT id FROM public.web_requests WHERE code = 'SOL-2026-000001' LIMIT 1),
  'DRAFT',
  '2026-08-10 09:00:00-06', '2026-08-15 16:00:00-06',
  6, 35.00, 210.00, 15.00, 200.00, 25.00, 450.00,
  '2026-08-05'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, amount, sort_order)
SELECT q.id, 'Alquiler diario Toyota Corolla', 6, 35.00, 210.00, 0
FROM public.quotes q
WHERE q.code = 'COT-2026-000001'
  AND NOT EXISTS (SELECT 1 FROM public.quote_items qi WHERE qi.quote_id = q.id);

-- ---------------------------------------------------------------------------
-- Sample expenses
-- ---------------------------------------------------------------------------

INSERT INTO public.expense_transactions (
  concept, category, amount, expense_date, vehicle_id, provider, notes
) VALUES
  ('Cambio de aceite y filtro', 'MAINTENANCE', 45.00, '2026-07-01',
   'b2000001-0000-4000-8000-000000000004', 'Taller El Motor', 'Mantenimiento programado'),
  ('Lavado completo', 'WASH', 8.00, '2026-07-15',
   'b2000001-0000-4000-8000-000000000001', 'Lavado Express', NULL),
  ('Publicidad Facebook', 'ADVERTISING', 50.00, '2026-07-01', NULL, 'Meta Ads', 'Campaña julio');

-- ---------------------------------------------------------------------------
-- Sample maintenance
-- ---------------------------------------------------------------------------

INSERT INTO public.maintenance_records (
  vehicle_id, type, status, description, maintenance_date, mileage, cost, workshop, next_date, next_mileage
) VALUES
  (
    'b2000001-0000-4000-8000-000000000004',
    'OIL', 'IN_PROGRESS',
    'Cambio de aceite 5W-30 y revisión general',
    '2026-07-25', 85000, 45.00, 'Taller El Motor',
    '2027-01-25', 90000
  ),
  (
    'b2000001-0000-4000-8000-000000000002',
    'TIRES', 'SCHEDULED',
    'Rotación de llantas',
    '2026-08-01', 32000, 0.00, 'Taller El Motor',
    '2026-11-01', 38000
  );

-- ---------------------------------------------------------------------------
-- Sample alert
-- ---------------------------------------------------------------------------

INSERT INTO public.alerts (
  alert_type, title, message, entity_type, entity_id, severity, dedupe_key, due_at
)
SELECT
  'maintenance_due',
  'Mantenimiento programado — Kia Rio',
  'El vehículo Kia Rio tiene mantenimiento en progreso.',
  'vehicle',
  'b2000001-0000-4000-8000-000000000004'::uuid,
  'warning',
  'maintenance:vehicle:b2000001-0000-4000-8000-000000000004:oil',
  now() + interval '7 days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.alerts
  WHERE dedupe_key = 'maintenance:vehicle:b2000001-0000-4000-8000-000000000004:oil'
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Creating auth users (manual steps)
-- ---------------------------------------------------------------------------
-- 1. Supabase Dashboard → Authentication → Users → Add user
-- 2. Copy the user UUID
-- 3. Run create_first_admin.sql with that UUID
-- Or use Supabase CLI: supabase auth admin create-user --email admin@example.com
