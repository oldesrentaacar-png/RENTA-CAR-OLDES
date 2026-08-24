-- OLDES Spec v1.1 alignment — customers company fields, vehicle types,
-- quote language/items catalog, reservation cash/card, payment receipts,
-- accessories catalog, mileage history, calendar events

-- ---------------------------------------------------------------------------
-- Customer type (person / company)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.customer_type AS ENUM ('PERSON', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type public.customer_type NOT NULL DEFAULT 'PERSON',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS nit text,
  ADD COLUMN IF NOT EXISTS nrc text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS additional_driver_name text,
  ADD COLUMN IF NOT EXISTS additional_driver_license text,
  ADD COLUMN IF NOT EXISTS document_image_url text,
  ADD COLUMN IF NOT EXISTS license_image_url text,
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS deliverer_name text;

-- ---------------------------------------------------------------------------
-- Public vehicle types (landing: type + rates only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  name                text NOT NULL,
  name_en             text,
  description         text,
  description_en      text,
  daily_rate          numeric(12, 2) NOT NULL DEFAULT 0,
  weekly_rate         numeric(12, 2),
  passengers          int NOT NULL DEFAULT 5 CHECK (passengers > 0),
  luggage             int NOT NULL DEFAULT 2 CHECK (luggage >= 0),
  doors               int NOT NULL DEFAULT 4 CHECK (doors > 0),
  air_conditioning    boolean NOT NULL DEFAULT true,
  transmission        text NOT NULL DEFAULT 'Automatic',
  features            jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url           text,
  sort_order          int NOT NULL DEFAULT 0,
  published_on_web    boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vehicle_types_published
  ON public.vehicle_types (published_on_web, sort_order)
  WHERE deleted_at IS NULL AND is_active = true;

DROP TRIGGER IF EXISTS trg_vehicle_types_updated_at ON public.vehicle_types;
CREATE TRIGGER trg_vehicle_types_updated_at
  BEFORE UPDATE ON public.vehicle_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type_id uuid REFERENCES public.vehicle_types (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engine_oil text,
  ADD COLUMN IF NOT EXISTS tire_info text;

CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles (vehicle_type_id)
  WHERE deleted_at IS NULL;

-- Seed common types if empty
INSERT INTO public.vehicle_types (
  slug, name, name_en, description, daily_rate, passengers, luggage, doors,
  air_conditioning, transmission, features, published_on_web, sort_order
)
SELECT * FROM (VALUES
  ('sedan', 'Sedán', 'Sedan', 'Ideal para ciudad y viajes cortos.', 45.00, 5, 2, 4, true, 'Automatic',
   '["A/C","Seguro incluido"]'::jsonb, true, 10),
  ('suv-2-row', 'SUV 2 filas', '2 Row SUV', 'Espacio familiar con buena capacidad de maletas.', 65.00, 5, 3, 4, true, 'Automatic',
   '["A/C","Seguro incluido"]'::jsonb, true, 20),
  ('suv-3-row', 'SUV 3 filas', '3 Row SUV', 'Máximo espacio para grupos y familias.', 85.00, 7, 4, 4, true, 'Automatic',
   '["A/C","Seguro incluido"]'::jsonb, true, 30),
  ('pickup', 'Pickup', 'Pickup', 'Utilitaria con palangana para carga.', 70.00, 5, 2, 4, true, 'Manual',
   '["A/C","Palangana"]'::jsonb, true, 40),
  ('minivan', 'Minivan', 'Minivan', 'Confort para grupos y aeropuerto.', 90.00, 8, 5, 4, true, 'Automatic',
   '["A/C","Seguro incluido"]'::jsonb, true, 50)
) AS t(slug, name, name_en, description, daily_rate, passengers, luggage, doors, air_conditioning, transmission, features, published_on_web, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_types LIMIT 1);

CREATE OR REPLACE VIEW public.public_vehicle_types AS
SELECT
  vt.id,
  vt.slug,
  vt.name,
  vt.name_en,
  vt.description,
  vt.description_en,
  vt.daily_rate,
  vt.weekly_rate,
  vt.passengers,
  vt.luggage,
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

-- Keep unit view for internal use; landing must prefer public_vehicle_types
COMMENT ON VIEW public.public_vehicles IS
  'Legacy unit catalog. Landing must use public_vehicle_types (types + rates only).';

-- ---------------------------------------------------------------------------
-- Quotes: language + optional vehicle + tax percent + welcome text
-- ---------------------------------------------------------------------------

ALTER TABLE public.quotes
  ALTER COLUMN vehicle_id DROP NOT NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('es', 'en')),
  ADD COLUMN IF NOT EXISTS vehicle_type_id uuid REFERENCES public.vehicle_types (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(6, 4) NOT NULL DEFAULT 0.13,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS welcome_text text,
  ADD COLUMN IF NOT EXISTS payment_conditions text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text,
  ADD COLUMN IF NOT EXISTS insurance_policy_text text,
  ADD COLUMN IF NOT EXISTS driving_guidelines text;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS item_code text,
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'CUSTOM'
    CHECK (item_type IN ('VEHICLE', 'SERVICE', 'TAX', 'DISCOUNT', 'CUSTOM')),
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(6, 4) NOT NULL DEFAULT 0;

-- Catalog of reusable quote articles/services
CREATE TABLE IF NOT EXISTS public.quote_catalog_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text,
  name_es         text NOT NULL,
  name_en         text NOT NULL,
  description_es  text,
  description_en  text,
  item_type       text NOT NULL DEFAULT 'SERVICE'
    CHECK (item_type IN ('VEHICLE', 'SERVICE', 'CUSTOM')),
  unit_price      numeric(12, 2) NOT NULL DEFAULT 0,
  tax_rate        numeric(6, 4) NOT NULL DEFAULT 0.13,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

DROP TRIGGER IF EXISTS trg_quote_catalog_updated_at ON public.quote_catalog_items;
CREATE TRIGGER trg_quote_catalog_updated_at
  BEFORE UPDATE ON public.quote_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.quote_catalog_items (code, name_es, name_en, description_es, description_en, item_type, unit_price, tax_rate, sort_order)
SELECT * FROM (VALUES
  ('DELIVERY', 'Entrega y/o fuera de horas laborales', 'Delivery and/or after-hours service',
   'Cargo por entrega o devolución fuera de horario.', 'Delivery or return outside business hours.',
   'SERVICE', 25.00, 0.13, 10),
  ('AIRPORT', 'Recogida/entrega aeropuerto', 'Airport pickup/drop-off',
   'Servicio aeropuerto 24/7.', '24/7 airport service.',
   'SERVICE', 0.00, 0.13, 20),
  ('CHILD_SEAT', 'Silla para niño', 'Child seat',
   'Silla infantil por día.', 'Child seat per day.',
   'SERVICE', 5.00, 0.13, 30),
  ('GPS', 'GPS / navegación', 'GPS navigation',
   'Unidad GPS por día.', 'GPS unit per day.',
   'SERVICE', 5.00, 0.13, 40)
) AS t(code, name_es, name_en, description_es, description_en, item_type, unit_price, tax_rate, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.quote_catalog_items LIMIT 1);

-- ---------------------------------------------------------------------------
-- Reservations: cash vs card amounts
-- ---------------------------------------------------------------------------

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS cash_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_costs numeric(12, 2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Contracts: billing extras / balance
-- ---------------------------------------------------------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS billed_days int,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_charges numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_charges numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_charges numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complementary_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID')),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by_name text,
  ADD COLUMN IF NOT EXISTS received_by_name text;

-- ---------------------------------------------------------------------------
-- Payment receipts (abonos electrónicos)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,
  customer_id        uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  contract_id        uuid REFERENCES public.contracts (id) ON DELETE SET NULL,
  reservation_id     uuid REFERENCES public.reservations (id) ON DELETE SET NULL,
  income_id          uuid REFERENCES public.income_transactions (id) ON DELETE SET NULL,
  amount             numeric(12, 2) NOT NULL CHECK (amount >= 0),
  payment_method     public.payment_method NOT NULL DEFAULT 'CASH',
  concept            text NOT NULL DEFAULT 'Abono',
  balance_remaining  numeric(12, 2) NOT NULL DEFAULT 0,
  notes              text,
  pdf_path           text,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer
  ON public.payment_receipts (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_receipts_contract
  ON public.payment_receipts (contract_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_payment_receipts_code ON public.payment_receipts;
CREATE TRIGGER trg_payment_receipts_code
  BEFORE INSERT ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code('REC');

DROP TRIGGER IF EXISTS trg_payment_receipts_updated_at ON public.payment_receipts;
CREATE TRIGGER trg_payment_receipts_updated_at
  BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.income_transactions
  ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES public.payment_receipts (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Accessories catalog (configurable)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.accessory_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_es     text NOT NULL,
  name_en     text,
  icon        text,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_accessory_catalog_updated_at ON public.accessory_catalog;
CREATE TRIGGER trg_accessory_catalog_updated_at
  BEFORE UPDATE ON public.accessory_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.accessory_catalog (code, name_es, name_en, icon, sort_order)
SELECT * FROM (VALUES
  ('SPARE_TIRE', 'Llanta de repuesto', 'Spare tire', 'circle', 10),
  ('MICA', 'Mica', 'Jack', 'wrench', 20),
  ('MICA_LEVER', 'Palanca de mica', 'Jack lever', 'tool', 30),
  ('CROSS_WRENCH', 'Llave de cruz', 'Cross wrench', 'wrench', 40),
  ('CONE', 'Cono o triángulo', 'Cone / triangle', 'alert-triangle', 50),
  ('EXTINGUISHER', 'Extintor', 'Fire extinguisher', 'flame', 60),
  ('JUMPER_CABLES', 'Cables para corriente', 'Jumper cables', 'zap', 70),
  ('WIPERS', 'Limpiaparabrisas', 'Wipers', 'droplets', 80),
  ('COVERS', 'Cubiertas', 'Covers', 'shield', 90)
) AS t(code, name_es, name_en, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.accessory_catalog LIMIT 1);

-- ---------------------------------------------------------------------------
-- Mileage history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vehicle_mileage_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  mileage         int NOT NULL CHECK (mileage >= 0),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL', 'CHECK_OUT', 'CHECK_IN', 'MAINTENANCE', 'OTHER')),
  inspection_id   uuid REFERENCES public.inspections (id) ON DELETE SET NULL,
  contract_id     uuid REFERENCES public.contracts (id) ON DELETE SET NULL,
  notes           text,
  created_by      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mileage_history_vehicle
  ON public.vehicle_mileage_history (vehicle_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Calendar non-rental events (holidays, maintenance blocks, appointments)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  event_type  text NOT NULL DEFAULT 'OTHER'
    CHECK (event_type IN ('HOLIDAY', 'MAINTENANCE', 'APPOINTMENT', 'OTHER')),
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  all_day     boolean NOT NULL DEFAULT true,
  color       text,
  vehicle_id  uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  notes       text,
  created_by  uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT calendar_events_dates_valid CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_range
  ON public.calendar_events (start_at, end_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Business settings defaults for OLDES contact
-- ---------------------------------------------------------------------------

UPDATE public.business_settings
SET
  business_name = COALESCE(NULLIF(business_name, ''), 'OLDES Rent a Car El Salvador'),
  phone = COALESCE(NULLIF(phone, ''), '+503 7435-0381'),
  whatsapp = COALESCE(NULLIF(whatsapp, ''), '+503 7435-0381'),
  address = NULL
WHERE id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessory_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_mileage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_types_staff ON public.vehicle_types;
CREATE POLICY vehicle_types_staff ON public.vehicle_types
  FOR ALL TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS quote_catalog_staff ON public.quote_catalog_items;
CREATE POLICY quote_catalog_staff ON public.quote_catalog_items
  FOR ALL TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS payment_receipts_staff ON public.payment_receipts;
CREATE POLICY payment_receipts_staff ON public.payment_receipts
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

DROP POLICY IF EXISTS accessory_catalog_staff ON public.accessory_catalog;
CREATE POLICY accessory_catalog_staff ON public.accessory_catalog
  FOR ALL TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS mileage_history_staff ON public.vehicle_mileage_history;
CREATE POLICY mileage_history_staff ON public.vehicle_mileage_history
  FOR ALL TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS calendar_events_staff ON public.calendar_events;
CREATE POLICY calendar_events_staff ON public.calendar_events
  FOR ALL TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());
