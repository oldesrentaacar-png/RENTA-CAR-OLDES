-- Rent A Car Pro — Customers and vehicles
-- Migration: 20260327000004

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE TABLE public.customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       text NOT NULL,
  last_name        text NOT NULL,
  identification   text,
  dui              text,
  passport         text,
  license_number   text,
  license_expiry   date,
  date_of_birth    date,
  phone            text NOT NULL,
  whatsapp         text,
  email            text,
  address          text,
  country          text DEFAULT 'El Salvador',
  notes            text,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_customers_phone ON public.customers (phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_email ON public.customers (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_identification ON public.customers (identification) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_license ON public.customers (license_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_name ON public.customers (last_name, first_name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------

CREATE TABLE public.vehicles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ownership_type     public.ownership_type NOT NULL DEFAULT 'OWN',
  status             public.vehicle_status NOT NULL DEFAULT 'AVAILABLE',
  published_on_web   boolean NOT NULL DEFAULT false,
  slug               text NOT NULL UNIQUE,
  category           text NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  archived_at        timestamptz,
  brand              text NOT NULL,
  model              text NOT NULL,
  year               int NOT NULL CHECK (year >= 1900 AND year <= 2100),
  plate              text NOT NULL,
  vin                text,
  chassis            text,
  engine_number      text,
  color              text,
  transmission       text NOT NULL DEFAULT 'Automatic',
  fuel_type          text NOT NULL DEFAULT 'Gasoline',
  passengers         int NOT NULL DEFAULT 5 CHECK (passengers > 0),
  doors              int NOT NULL DEFAULT 4 CHECK (doors > 0),
  luggage            int NOT NULL DEFAULT 2 CHECK (luggage >= 0),
  air_conditioning   boolean NOT NULL DEFAULT true,
  daily_rate         numeric(12, 2) NOT NULL DEFAULT 0,
  weekly_rate        numeric(12, 2),
  deposit            numeric(12, 2),
  public_description text,
  owner_name         text,
  owner_phone        text,
  internal_notes     text,
  current_mileage    int CHECK (current_mileage IS NULL OR current_mileage >= 0),
  created_by         uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE INDEX idx_vehicles_status ON public.vehicles (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_published ON public.vehicles (published_on_web) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_vehicles_active ON public.vehicles (is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_category ON public.vehicles (category) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_plate ON public.vehicles (plate) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vehicle images (Cloudinary)
-- ---------------------------------------------------------------------------

CREATE TABLE public.vehicle_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  url         text NOT NULL,
  public_id   text NOT NULL,
  position    int NOT NULL DEFAULT 0,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_images_vehicle ON public.vehicle_images (vehicle_id, position);

-- ---------------------------------------------------------------------------
-- Public vehicles view (safe fields for Landing / anon read)
-- The public API may also use the service role with equivalent filters.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_vehicles AS
SELECT
  v.id,
  v.slug,
  v.brand,
  v.model,
  v.year,
  v.category,
  v.transmission,
  v.passengers,
  v.luggage,
  v.air_conditioning,
  v.daily_rate,
  v.public_description
FROM public.vehicles v
WHERE v.published_on_web = true
  AND v.is_active = true
  AND v.deleted_at IS NULL
  AND v.archived_at IS NULL
  AND v.status NOT IN ('ARCHIVED', 'UNAVAILABLE');

COMMENT ON VIEW public.public_vehicles IS
  'Public-safe vehicle catalog. Landing should prefer GET /api/public/vehicles (service role) or this view.';
