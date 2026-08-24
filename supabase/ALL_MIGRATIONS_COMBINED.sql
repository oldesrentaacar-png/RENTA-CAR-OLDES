-- OLDES Rent-a-Car: ejecutar UNA VEZ en Supabase SQL Editor 
-- Project Settings > Database > SQL Editor > New query 
 
-- ===== 20260327000001_extensions_and_enums.sql ===== 
-- Rent A Car Pro — Extensions and enums
-- Migration: 20260327000001

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);

CREATE TYPE public.permission_effect AS ENUM (
  'GRANT',
  'DENY'
);

CREATE TYPE public.ownership_type AS ENUM (
  'OWN',
  'THIRD_PARTY',
  'SUBLEASED',
  'CONSIGNMENT'
);

CREATE TYPE public.vehicle_status AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'MAINTENANCE',
  'UNAVAILABLE',
  'ARCHIVED'
);

CREATE TYPE public.web_request_status AS ENUM (
  'PENDING',
  'CONTACTED',
  'QUOTED',
  'CONVERTED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE public.web_request_source AS ENUM (
  'WEBSITE',
  'PHONE',
  'WHATSAPP',
  'WALK_IN',
  'OTHER'
);

CREATE TYPE public.quote_status AS ENUM (
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE public.reservation_status AS ENUM (
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.contract_status AS ENUM (
  'PENDING',
  'CLIENT_SIGNED',
  'REPRESENTATIVE_SIGNED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.signer_type AS ENUM (
  'CLIENT',
  'REPRESENTATIVE'
);

CREATE TYPE public.inspection_type AS ENUM (
  'CHECK_OUT',
  'CHECK_IN'
);

CREATE TYPE public.checklist_item_status AS ENUM (
  'OK',
  'DAMAGED',
  'MISSING',
  'NOT_APPLICABLE'
);

CREATE TYPE public.damage_type AS ENUM (
  'SCRATCH',
  'DENT',
  'CRACK',
  'PAINT',
  'BROKEN',
  'OTHER'
);

CREATE TYPE public.damage_severity AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE public.vehicle_view AS ENUM (
  'TOP',
  'FRONT',
  'REAR',
  'LEFT',
  'RIGHT'
);

CREATE TYPE public.inspection_photo_category AS ENUM (
  'FRONT',
  'REAR',
  'LEFT',
  'RIGHT',
  'INTERIOR',
  'DASHBOARD',
  'WHEELS',
  'DAMAGE',
  'OTHER'
);

CREATE TYPE public.income_type AS ENUM (
  'RENTAL',
  'DEPOSIT',
  'INSURANCE',
  'EXTRA',
  'OTHER'
);

CREATE TYPE public.deposit_status AS ENUM (
  'RECEIVED',
  'HELD',
  'RETURNED',
  'APPLIED',
  'PARTIALLY_APPLIED'
);

CREATE TYPE public.payment_method AS ENUM (
  'CASH',
  'TRANSFER',
  'CARD',
  'OTHER'
);

CREATE TYPE public.expense_category AS ENUM (
  'MAINTENANCE',
  'FUEL',
  'INSURANCE',
  'STAFF',
  'ADVERTISING',
  'WASH',
  'PARTS',
  'COMMISSIONS',
  'FINES',
  'OTHER'
);

CREATE TYPE public.maintenance_type AS ENUM (
  'OIL',
  'BRAKES',
  'TIRES',
  'ENGINE',
  'TRANSMISSION',
  'AC',
  'ELECTRICAL',
  'BODY',
  'GENERAL',
  'OTHER'
);

CREATE TYPE public.maintenance_status AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.fuel_level AS ENUM (
  'EMPTY',
  'QUARTER',
  'HALF',
  'THREE_QUARTERS',
  'FULL'
);
 
-- ===== 20260327000002_core_rbac.sql ===== 
-- Rent A Car Pro — Core RBAC (roles, permissions, profiles)
-- Migration: 20260327000002

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

CREATE TABLE public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roles_slug ON public.roles (slug);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

CREATE TABLE public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  module      text NOT NULL,
  description text
);

CREATE INDEX idx_permissions_module ON public.permissions (module);
CREATE INDEX idx_permissions_key ON public.permissions (key);

-- ---------------------------------------------------------------------------
-- Role ↔ Permission
-- ---------------------------------------------------------------------------

CREATE TABLE public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission ON public.role_permissions (permission_id);

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name    text,
  last_name     text,
  email         text,
  phone         text,
  avatar_url    text,
  role_id       uuid REFERENCES public.roles (id) ON DELETE SET NULL,
  status        public.user_status NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role_id ON public.profiles (role_id);
CREATE INDEX idx_profiles_status ON public.profiles (status);
CREATE INDEX idx_profiles_email ON public.profiles (email);

-- ---------------------------------------------------------------------------
-- Per-user permission overrides
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_permission_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  effect        public.permission_effect NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX idx_user_permission_overrides_user ON public.user_permission_overrides (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional: profile bootstrap on auth signup
-- Profiles for staff are normally created by an administrator via the dashboard.
-- Uncomment the trigger below if you want a minimal profile row on every signup.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    'INACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- NOT enabled by default — staff accounts are provisioned by admin:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Optional: last login tracking (call from app on successful login)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_last_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = now()
  WHERE id = p_user_id;
END;
$$;
 
-- ===== 20260327000003_business_and_sequences.sql ===== 
-- Rent A Car Pro — Business settings, document sequences, permission helpers
-- Migration: 20260327000003

-- ---------------------------------------------------------------------------
-- Business settings (singleton row expected)
-- ---------------------------------------------------------------------------

CREATE TABLE public.business_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name         text NOT NULL DEFAULT 'OLDES Rent-a-Car',
  legal_name            text,
  logo_url              text,
  address               text,
  phone                 text,
  whatsapp              text,
  email                 text,
  currency              text NOT NULL DEFAULT 'USD',
  timezone              text NOT NULL DEFAULT 'America/El_Salvador',
  quote_terms           text,
  contract_terms        text,
  default_deposit       numeric(12, 2) NOT NULL DEFAULT 200.00,
  default_insurance     numeric(12, 2) NOT NULL DEFAULT 0.00,
  default_delivery_fee  numeric(12, 2) NOT NULL DEFAULT 0.00,
  policies              jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Transactional document sequences (SOL, COT, RES, CTR, INS)
-- ---------------------------------------------------------------------------

CREATE TABLE public.document_sequences (
  doc_type   text NOT NULL,
  year       int  NOT NULL,
  last_value int  NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);

-- ---------------------------------------------------------------------------
-- next_document_code — e.g. COT-2026-000001
-- Uses America/El_Salvador for the year component.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_document_code(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_next int;
BEGIN
  v_year := EXTRACT(
    YEAR FROM (now() AT TIME ZONE 'America/El_Salvador')
  )::int;

  INSERT INTO public.document_sequences (doc_type, year, last_value)
  VALUES (p_doc_type, v_year, 1)
  ON CONFLICT (doc_type, year)
  DO UPDATE SET last_value = public.document_sequences.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN p_doc_type || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- Assign document code on INSERT when code is null/empty
CREATE OR REPLACE FUNCTION public.set_document_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := public.next_document_code(TG_ARGV[0]);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permission resolution
-- effective = (role_permissions ∪ GRANT overrides) − DENY overrides
-- User must be ACTIVE.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.user_status;
  v_role_id uuid;
  v_permission_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.status, p.role_id
  INTO v_status, v_role_id
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_status <> 'ACTIVE' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_permission_id
  FROM public.permissions
  WHERE key = p_key;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Explicit DENY wins
  IF EXISTS (
    SELECT 1
    FROM public.user_permission_overrides uo
    WHERE uo.user_id = p_user_id
      AND uo.permission_id = v_permission_id
      AND uo.effect = 'DENY'
  ) THEN
    RETURN false;
  END IF;

  -- Explicit GRANT
  IF EXISTS (
    SELECT 1
    FROM public.user_permission_overrides uo
    WHERE uo.user_id = p_user_id
      AND uo.permission_id = v_permission_id
      AND uo.effect = 'GRANT'
  ) THEN
    RETURN true;
  END IF;

  -- Role permission
  IF v_role_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = v_role_id
      AND rp.permission_id = v_permission_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- Convenience helper for RLS policies (current authenticated staff)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'ACTIVE'
  );
$$;

 
-- ===== 20260327000004_customers_vehicles.sql ===== 
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
 
-- ===== 20260327000005_requests_quotes_reservations.sql ===== 
-- Rent A Car Pro — Web requests, quotes, reservations
-- Migration: 20260327000005

-- ---------------------------------------------------------------------------
-- Web requests (Landing submissions — NOT reservations)
-- ---------------------------------------------------------------------------

CREATE TABLE public.web_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  first_name        text NOT NULL,
  last_name         text NOT NULL,
  phone             text NOT NULL,
  email             text,
  pickup_date       date NOT NULL,
  pickup_time       time,
  return_date       date NOT NULL,
  return_time       time,
  vehicle_id        uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  vehicle_category  text,
  pickup_location   text,
  return_location   text,
  notes             text,
  source            public.web_request_source NOT NULL DEFAULT 'WEBSITE',
  status            public.web_request_status NOT NULL DEFAULT 'PENDING',
  customer_id       uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  assigned_to       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT web_requests_dates_valid CHECK (return_date >= pickup_date)
);

CREATE INDEX idx_web_requests_status ON public.web_requests (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_web_requests_customer ON public.web_requests (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_web_requests_vehicle ON public.web_requests (vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_web_requests_created ON public.web_requests (created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_web_requests_code
  BEFORE INSERT ON public.web_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code('SOL');

CREATE TRIGGER trg_web_requests_updated_at
  BEFORE UPDATE ON public.web_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Web request status history
-- ---------------------------------------------------------------------------

CREATE TABLE public.web_request_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  web_request_id  uuid NOT NULL REFERENCES public.web_requests (id) ON DELETE CASCADE,
  old_status      public.web_request_status,
  new_status      public.web_request_status NOT NULL,
  changed_by      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_request_history_request ON public.web_request_status_history (web_request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_web_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.web_request_status_history (web_request_id, old_status, new_status)
    VALUES (NEW.id, NULL, NEW.status);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.web_request_status_history (web_request_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_web_requests_status_history
  AFTER INSERT OR UPDATE OF status ON public.web_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_web_request_status_change();

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------

CREATE TABLE public.quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  customer_id     uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE RESTRICT,
  web_request_id  uuid REFERENCES public.web_requests (id) ON DELETE SET NULL,
  status          public.quote_status NOT NULL DEFAULT 'DRAFT',
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  days            int NOT NULL CHECK (days > 0),
  daily_rate      numeric(12, 2) NOT NULL DEFAULT 0,
  subtotal        numeric(12, 2) NOT NULL DEFAULT 0,
  insurance       numeric(12, 2) NOT NULL DEFAULT 0,
  deposit         numeric(12, 2) NOT NULL DEFAULT 0,
  delivery_fee    numeric(12, 2) NOT NULL DEFAULT 0,
  pickup_fee      numeric(12, 2) NOT NULL DEFAULT 0,
  discount        numeric(12, 2) NOT NULL DEFAULT 0,
  other_charges   numeric(12, 2) NOT NULL DEFAULT 0,
  tax             numeric(12, 2) NOT NULL DEFAULT 0,
  total           numeric(12, 2) NOT NULL DEFAULT 0,
  notes           text,
  terms           text,
  valid_until     date,
  pdf_path        text,
  created_by      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT quotes_dates_valid CHECK (end_at > start_at)
);

CREATE INDEX idx_quotes_customer ON public.quotes (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_status ON public.quotes (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotes_vehicle ON public.quotes (vehicle_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_quotes_code
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code('COT');

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quote line items
-- ---------------------------------------------------------------------------

CREATE TABLE public.quote_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric(12, 2) NOT NULL DEFAULT 0,
  amount      numeric(12, 2) NOT NULL DEFAULT 0,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE INDEX idx_quote_items_quote ON public.quote_items (quote_id, sort_order);

-- ---------------------------------------------------------------------------
-- Reservations (real bookings — overlap protection via exclusion constraint)
-- ---------------------------------------------------------------------------

CREATE TABLE public.reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  customer_id      uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  vehicle_id       uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE RESTRICT,
  quote_id         uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  status           public.reservation_status NOT NULL DEFAULT 'CONFIRMED',
  start_at         timestamptz NOT NULL,
  end_at           timestamptz NOT NULL,
  pickup_location  text,
  return_location  text,
  agreed_rate      numeric(12, 2) NOT NULL DEFAULT 0,
  deposit          numeric(12, 2) NOT NULL DEFAULT 0,
  insurance        numeric(12, 2) NOT NULL DEFAULT 0,
  total            numeric(12, 2) NOT NULL DEFAULT 0,
  notes            text,
  created_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT reservations_dates_valid CHECK (end_at > start_at)
);

CREATE INDEX idx_reservations_vehicle_dates
  ON public.reservations (vehicle_id, start_at, end_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_reservations_customer ON public.reservations (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reservations_status ON public.reservations (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_reservations_start ON public.reservations (start_at) WHERE deleted_at IS NULL;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED' AND deleted_at IS NULL);

CREATE TRIGGER trg_reservations_code
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code('RES');

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON CONSTRAINT reservations_no_overlap ON public.reservations IS
  'Prevents overlapping active reservations for the same vehicle. CANCELLED and soft-deleted rows are excluded.';
 
-- ===== 20260327000006_contracts_inspections.sql ===== 
-- Rent A Car Pro — Contracts and inspections
-- Migration: 20260327000006

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

CREATE TABLE public.contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  reservation_id  uuid NOT NULL REFERENCES public.reservations (id) ON DELETE RESTRICT,
  customer_id     uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE RESTRICT,
  status          public.contract_status NOT NULL DEFAULT 'PENDING',
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  agreed_rate     numeric(12, 2) NOT NULL DEFAULT 0,
  deposit         numeric(12, 2) NOT NULL DEFAULT 0,
  insurance       numeric(12, 2) NOT NULL DEFAULT 0,
  total           numeric(12, 2) NOT NULL DEFAULT 0,
  terms           text,
  clauses         text,
  notes           text,
  pdf_path        text,
  created_by      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT contracts_dates_valid CHECK (end_at > start_at)
);

CREATE INDEX idx_contracts_reservation ON public.contracts (reservation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_customer ON public.contracts (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_vehicle ON public.contracts (vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_status ON public.contracts (status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_contracts_code
  BEFORE INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code('CTR');

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contract signatures (private — Supabase Storage paths)
-- ---------------------------------------------------------------------------

CREATE TABLE public.contract_signatures (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        uuid NOT NULL REFERENCES public.contracts (id) ON DELETE CASCADE,
  signer_type        public.signer_type NOT NULL,
  signed_by_name     text NOT NULL,
  signed_by_user_id  uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  signature_path     text NOT NULL,
  signed_at          timestamptz NOT NULL DEFAULT now(),
  ip_address         inet,
  user_agent         text,
  UNIQUE (contract_id, signer_type)
);

CREATE INDEX idx_contract_signatures_contract ON public.contract_signatures (contract_id);

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------

CREATE TABLE public.inspections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text UNIQUE,
  reservation_id   uuid NOT NULL REFERENCES public.reservations (id) ON DELETE RESTRICT,
  vehicle_id       uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE RESTRICT,
  customer_id      uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  type             public.inspection_type NOT NULL,
  inspection_date  timestamptz NOT NULL DEFAULT now(),
  mileage          int CHECK (mileage IS NULL OR mileage >= 0),
  fuel_level       public.fuel_level,
  notes            text,
  created_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspections_reservation ON public.inspections (reservation_id);
CREATE INDEX idx_inspections_vehicle ON public.inspections (vehicle_id);
CREATE INDEX idx_inspections_type ON public.inspections (type);

CREATE TRIGGER trg_inspections_code
  BEFORE INSERT ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code('INS');

CREATE TRIGGER trg_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inspection checklist items
-- ---------------------------------------------------------------------------

CREATE TABLE public.inspection_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections (id) ON DELETE CASCADE,
  item_name     text NOT NULL,
  status        public.checklist_item_status NOT NULL DEFAULT 'OK',
  notes         text,
  sort_order    int NOT NULL DEFAULT 0
);

CREATE INDEX idx_inspection_checklist_inspection ON public.inspection_checklist_items (inspection_id, sort_order);

-- ---------------------------------------------------------------------------
-- Inspection photos (private storage)
-- ---------------------------------------------------------------------------

CREATE TABLE public.inspection_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections (id) ON DELETE CASCADE,
  category      public.inspection_photo_category NOT NULL DEFAULT 'OTHER',
  storage_path  text NOT NULL,
  file_name     text,
  caption       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspection_photos_inspection ON public.inspection_photos (inspection_id);

-- ---------------------------------------------------------------------------
-- Inspection damage marks (normalized 0.0–1.0 coordinates on 2D SVG map)
-- ---------------------------------------------------------------------------

CREATE TABLE public.inspection_damage_marks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections (id) ON DELETE CASCADE,
  view          public.vehicle_view NOT NULL,
  x             numeric(6, 5) NOT NULL CHECK (x >= 0 AND x <= 1),
  y             numeric(6, 5) NOT NULL CHECK (y >= 0 AND y <= 1),
  damage_type   public.damage_type NOT NULL DEFAULT 'SCRATCH',
  severity      public.damage_severity NOT NULL DEFAULT 'LOW',
  description   text,
  photo_id      uuid REFERENCES public.inspection_photos (id) ON DELETE SET NULL,
  mark_number   int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspection_damage_inspection ON public.inspection_damage_marks (inspection_id);

-- Default checklist template (reference list — items created per inspection in app)
COMMENT ON TABLE public.inspection_checklist_items IS
  'Per-inspection checklist. Standard items: Body, Windshield, Windows, Mirrors, Headlights, Taillights, Tires, Rims, Interior, Seats, Dashboard, A/C, Radio, Documentation, Tools, Spare tire.';
 
-- ===== 20260327000007_finance_maintenance_alerts.sql ===== 
-- Rent A Car Pro — Finance, maintenance, alerts, audit
-- Migration: 20260327000007

-- ---------------------------------------------------------------------------
-- Income transactions
-- ---------------------------------------------------------------------------

CREATE TABLE public.income_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             public.income_type NOT NULL,
  amount           numeric(12, 2) NOT NULL CHECK (amount >= 0),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id       uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  reservation_id   uuid REFERENCES public.reservations (id) ON DELETE SET NULL,
  contract_id      uuid REFERENCES public.contracts (id) ON DELETE SET NULL,
  customer_id      uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  payment_method   public.payment_method NOT NULL DEFAULT 'CASH',
  deposit_status   public.deposit_status,
  reference        text,
  notes            text,
  created_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT income_deposit_status_check CHECK (
    (type = 'DEPOSIT' AND deposit_status IS NOT NULL)
    OR (type <> 'DEPOSIT' AND deposit_status IS NULL)
  )
);

CREATE INDEX idx_income_date ON public.income_transactions (transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_income_vehicle ON public.income_transactions (vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_income_reservation ON public.income_transactions (reservation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_income_type ON public.income_transactions (type) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_income_updated_at
  BEFORE UPDATE ON public.income_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expense transactions
-- ---------------------------------------------------------------------------

CREATE TABLE public.expense_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept       text NOT NULL,
  category      public.expense_category NOT NULL DEFAULT 'OTHER',
  amount        numeric(12, 2) NOT NULL CHECK (amount >= 0),
  expense_date  date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id    uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  provider      text,
  receipt_path  text,
  notes         text,
  created_by    uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_expense_date ON public.expense_transactions (expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_vehicle ON public.expense_transactions (vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_category ON public.expense_transactions (category) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_expense_updated_at
  BEFORE UPDATE ON public.expense_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Maintenance records
-- ---------------------------------------------------------------------------

CREATE TABLE public.maintenance_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE RESTRICT,
  type              public.maintenance_type NOT NULL DEFAULT 'GENERAL',
  status            public.maintenance_status NOT NULL DEFAULT 'SCHEDULED',
  description       text NOT NULL,
  maintenance_date  date NOT NULL DEFAULT CURRENT_DATE,
  mileage           int CHECK (mileage IS NULL OR mileage >= 0),
  cost              numeric(12, 2) NOT NULL DEFAULT 0,
  workshop          text,
  next_date         date,
  next_mileage      int CHECK (next_mileage IS NULL OR next_mileage >= 0),
  notes             text,
  receipt_path      text,
  created_by        uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_vehicle ON public.maintenance_records (vehicle_id);
CREATE INDEX idx_maintenance_status ON public.maintenance_records (status);
CREATE INDEX idx_maintenance_next_date ON public.maintenance_records (next_date) WHERE status <> 'CANCELLED';

CREATE TRIGGER trg_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Alerts (deduplicated while active)
-- ---------------------------------------------------------------------------

CREATE TABLE public.alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type   text NOT NULL,
  title        text NOT NULL,
  message      text,
  entity_type  text,
  entity_id    uuid,
  severity     text NOT NULL DEFAULT 'info',
  dedupe_key   text,
  is_active    boolean NOT NULL DEFAULT true,
  is_read      boolean NOT NULL DEFAULT false,
  due_at       timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE INDEX idx_alerts_active ON public.alerts (is_active, due_at) WHERE is_active = true;
CREATE INDEX idx_alerts_type ON public.alerts (alert_type) WHERE is_active = true;

CREATE UNIQUE INDEX idx_alerts_dedupe_key_active
  ON public.alerts (dedupe_key)
  WHERE is_active = true AND dedupe_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Audit log insert helper (service / security definer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata, p_ip_address)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_audit_log IS
  'Insert audit entries bypassing RLS. Call from server-side code with service role or authenticated context.';
 
-- ===== 20260327000008_rls_policies.sql ===== 
-- Rent A Car Pro — Row Level Security policies
-- Migration: 20260327000008

-- ===========================================================================
-- Enable RLS on all application tables
-- ===========================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_damage_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- Helper macro pattern (documented):
--   public.is_active_staff() AND public.has_permission(auth.uid(), '<key>')
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Roles & permissions (roles.manage)
-- ---------------------------------------------------------------------------

CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY roles_insert ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY roles_update ON public.roles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY roles_delete ON public.roles
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage') AND is_system = false);

CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND (
    public.has_permission(auth.uid(), 'roles.manage')
    OR public.has_permission(auth.uid(), 'users.view')
  ));

CREATE POLICY role_permissions_all ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY user_overrides_all ON public.user_permission_overrides
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'roles.manage'));

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.view'));

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.create'));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_staff ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'users.edit'));

-- ---------------------------------------------------------------------------
-- Business settings
-- ---------------------------------------------------------------------------

CREATE POLICY business_settings_select ON public.business_settings
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.view'));

CREATE POLICY business_settings_update ON public.business_settings
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY business_settings_insert ON public.business_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'settings.edit'));

-- Document sequences: no direct client access (use next_document_code)
CREATE POLICY document_sequences_deny ON public.document_sequences
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.view'));

CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.create'));

CREATE POLICY customers_update ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.edit'));

CREATE POLICY customers_delete ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'customers.delete'));

-- ---------------------------------------------------------------------------
-- Vehicles & images
-- ---------------------------------------------------------------------------

CREATE POLICY vehicles_select ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.view'));

CREATE POLICY vehicles_insert ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.create'));

CREATE POLICY vehicles_update ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'));

CREATE POLICY vehicles_delete ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.archive'));

-- Anonymous read for published catalog (used by public_vehicles view / Landing)
CREATE POLICY vehicles_public_read ON public.vehicles
  FOR SELECT TO anon
  USING (
    published_on_web = true
    AND is_active = true
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND status NOT IN ('ARCHIVED', 'UNAVAILABLE')
  );

CREATE POLICY vehicle_images_all ON public.vehicle_images
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.edit'));

CREATE POLICY vehicle_images_select ON public.vehicle_images
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'vehicles.view'));

-- ---------------------------------------------------------------------------
-- Web requests
-- POST /api/public/requests uses SUPABASE_SERVICE_ROLE_KEY — not anon INSERT.
-- ---------------------------------------------------------------------------

CREATE POLICY web_requests_select ON public.web_requests
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.view'));

CREATE POLICY web_requests_insert ON public.web_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.create'));

CREATE POLICY web_requests_update ON public.web_requests
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.edit'));

CREATE POLICY web_requests_delete ON public.web_requests
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.delete'));

-- Deny anonymous direct insert (Landing uses server API with service role)
CREATE POLICY web_requests_deny_anon ON public.web_requests
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY web_request_history_select ON public.web_request_status_history
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'requests.view'));

-- History rows are inserted by SECURITY DEFINER trigger

-- ---------------------------------------------------------------------------
-- Quotes & items
-- ---------------------------------------------------------------------------

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.view'));

CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.create'));

CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.edit'));

CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.delete'));

CREATE POLICY quote_items_all ON public.quote_items
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND (
    public.has_permission(auth.uid(), 'quotes.edit')
    OR public.has_permission(auth.uid(), 'quotes.view')
  ))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'quotes.edit'));

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------

CREATE POLICY reservations_select ON public.reservations
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.view'));

CREATE POLICY reservations_insert ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.create'));

CREATE POLICY reservations_update ON public.reservations
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.edit'));

CREATE POLICY reservations_delete ON public.reservations
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'reservations.cancel'));

-- ---------------------------------------------------------------------------
-- Contracts & signatures
-- ---------------------------------------------------------------------------

CREATE POLICY contracts_select ON public.contracts
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.view'));

CREATE POLICY contracts_insert ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.create'));

CREATE POLICY contracts_update ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.edit'));

CREATE POLICY contracts_delete ON public.contracts
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.cancel'));

CREATE POLICY contract_signatures_select ON public.contract_signatures
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.view'));

CREATE POLICY contract_signatures_insert ON public.contract_signatures
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'contracts.sign'));

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------

CREATE POLICY inspections_select ON public.inspections
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'));

CREATE POLICY inspections_insert ON public.inspections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.create'));

CREATE POLICY inspections_update ON public.inspections
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

CREATE POLICY inspection_checklist_all ON public.inspection_checklist_items
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

CREATE POLICY inspection_photos_all ON public.inspection_photos
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

CREATE POLICY inspection_damage_all ON public.inspection_damage_marks
  FOR ALL TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'inspections.edit'));

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------

CREATE POLICY income_select ON public.income_transactions
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

CREATE POLICY income_insert ON public.income_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

CREATE POLICY income_update ON public.income_transactions
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

CREATE POLICY income_delete ON public.income_transactions
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

CREATE POLICY expense_select ON public.expense_transactions
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

CREATE POLICY expense_insert ON public.expense_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

CREATE POLICY expense_update ON public.expense_transactions
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

CREATE POLICY expense_delete ON public.expense_transactions
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

-- ---------------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------------

CREATE POLICY maintenance_select ON public.maintenance_records
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.view'));

CREATE POLICY maintenance_insert ON public.maintenance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.create'));

CREATE POLICY maintenance_update ON public.maintenance_records
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'maintenance.edit'));

-- ---------------------------------------------------------------------------
-- Alerts (visible to active staff with dashboard access)
-- ---------------------------------------------------------------------------

CREATE POLICY alerts_select ON public.alerts
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'));

CREATE POLICY alerts_update ON public.alerts
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'));

CREATE POLICY alerts_insert ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'dashboard.view'));

-- ---------------------------------------------------------------------------
-- Audit logs (read-only for staff; inserts via insert_audit_log SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'audit.view'));

CREATE POLICY audit_logs_deny_client_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Public vehicles view — optional anon read (API may use service role instead)
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.public_vehicles TO anon, authenticated;

COMMENT ON POLICY web_requests_deny_anon ON public.web_requests IS
  'Landing POST /api/public/requests must use Next.js server with SUPABASE_SERVICE_ROLE_KEY.';
 
-- ===== 20260327000009_seed_permissions_roles.sql ===== 
-- Rent A Car Pro — Seed permissions, roles, business settings
-- Migration: 20260327000009_seed_permissions_roles.sql

-- ---------------------------------------------------------------------------
-- Permissions catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (key, module, description) VALUES
  ('dashboard.view', 'dashboard', 'Ver panel principal'),

  ('requests.view', 'requests', 'Ver solicitudes de la Landing'),
  ('requests.create', 'requests', 'Crear solicitudes manualmente'),
  ('requests.edit', 'requests', 'Editar solicitudes'),
  ('requests.delete', 'requests', 'Eliminar solicitudes'),

  ('customers.view', 'customers', 'Ver clientes'),
  ('customers.create', 'customers', 'Crear clientes'),
  ('customers.edit', 'customers', 'Editar clientes'),
  ('customers.delete', 'customers', 'Eliminar clientes'),

  ('quotes.view', 'quotes', 'Ver cotizaciones'),
  ('quotes.create', 'quotes', 'Crear cotizaciones'),
  ('quotes.edit', 'quotes', 'Editar cotizaciones'),
  ('quotes.delete', 'quotes', 'Eliminar cotizaciones'),
  ('quotes.send', 'quotes', 'Enviar cotizaciones'),
  ('quotes.accept', 'quotes', 'Aceptar/rechazar cotizaciones'),

  ('reservations.view', 'reservations', 'Ver reservas'),
  ('reservations.create', 'reservations', 'Crear reservas'),
  ('reservations.edit', 'reservations', 'Editar reservas'),
  ('reservations.cancel', 'reservations', 'Cancelar reservas'),

  ('vehicles.view', 'vehicles', 'Ver vehículos'),
  ('vehicles.create', 'vehicles', 'Crear vehículos'),
  ('vehicles.edit', 'vehicles', 'Editar vehículos'),
  ('vehicles.archive', 'vehicles', 'Archivar vehículos'),
  ('vehicles.publish', 'vehicles', 'Publicar vehículos en Landing'),

  ('contracts.view', 'contracts', 'Ver contratos'),
  ('contracts.create', 'contracts', 'Crear contratos'),
  ('contracts.edit', 'contracts', 'Editar contratos'),
  ('contracts.sign', 'contracts', 'Firmar contratos'),
  ('contracts.cancel', 'contracts', 'Cancelar contratos'),

  ('inspections.view', 'inspections', 'Ver inspecciones'),
  ('inspections.create', 'inspections', 'Crear inspecciones'),
  ('inspections.edit', 'inspections', 'Editar inspecciones'),

  ('finance.view', 'finance', 'Ver finanzas'),
  ('finance.create', 'finance', 'Registrar ingresos/gastos'),
  ('finance.edit', 'finance', 'Editar transacciones financieras'),
  ('finance.delete', 'finance', 'Eliminar transacciones financieras'),

  ('maintenance.view', 'maintenance', 'Ver mantenimiento'),
  ('maintenance.create', 'maintenance', 'Registrar mantenimiento'),
  ('maintenance.edit', 'maintenance', 'Editar mantenimiento'),

  ('reports.view', 'reports', 'Ver reportes'),
  ('reports.export', 'reports', 'Exportar reportes'),

  ('users.view', 'users', 'Ver usuarios'),
  ('users.create', 'users', 'Crear usuarios'),
  ('users.edit', 'users', 'Editar usuarios'),
  ('users.disable', 'users', 'Desactivar usuarios'),

  ('roles.manage', 'roles', 'Administrar roles y permisos'),

  ('settings.view', 'settings', 'Ver configuración del negocio'),
  ('settings.edit', 'settings', 'Editar configuración del negocio'),

  ('audit.view', 'audit', 'Ver auditoría')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- System roles
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (name, slug, description, is_system) VALUES
  ('Administrador', 'administrador', 'Acceso total al sistema', true),
  ('Gerente', 'gerente', 'Gestión operativa y reportes', true),
  ('Recepción', 'recepcion', 'Atención al cliente y operación diaria', true),
  ('Empleado', 'empleado', 'Acceso básico de consulta', true),
  ('Contabilidad', 'contabilidad', 'Finanzas y reportes', true),
  ('Mantenimiento', 'mantenimiento', 'Flota y mantenimiento', true)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role ↔ permission mappings
-- ---------------------------------------------------------------------------

-- Administrador: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'administrador'
ON CONFLICT DO NOTHING;

-- Gerente: all except users/roles admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key NOT IN (
  'users.create', 'users.edit', 'users.disable', 'roles.manage'
)
WHERE r.slug = 'gerente'
ON CONFLICT DO NOTHING;

-- Recepción: operation modules
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'requests.view', 'requests.create', 'requests.edit',
  'customers.view', 'customers.create', 'customers.edit',
  'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.send', 'quotes.accept',
  'reservations.view', 'reservations.create', 'reservations.edit',
  'vehicles.view',
  'contracts.view', 'contracts.create',
  'inspections.view', 'inspections.create',
  'settings.view'
)
WHERE r.slug = 'recepcion'
ON CONFLICT DO NOTHING;

-- Empleado: read-only basics
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'requests.view',
  'customers.view',
  'quotes.view',
  'reservations.view',
  'vehicles.view',
  'contracts.view',
  'inspections.view',
  'settings.view'
)
WHERE r.slug = 'empleado'
ON CONFLICT DO NOTHING;

-- Contabilidad: finance + reports + read operation
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'customers.view',
  'quotes.view',
  'reservations.view',
  'vehicles.view',
  'contracts.view',
  'finance.view', 'finance.create', 'finance.edit', 'finance.delete',
  'reports.view', 'reports.export',
  'settings.view'
)
WHERE r.slug = 'contabilidad'
ON CONFLICT DO NOTHING;

-- Mantenimiento: fleet maintenance
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'dashboard.view',
  'vehicles.view', 'vehicles.edit',
  'maintenance.view', 'maintenance.create', 'maintenance.edit',
  'inspections.view', 'inspections.create', 'inspections.edit',
  'settings.view'
)
WHERE r.slug = 'mantenimiento'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Business settings — OLDES Rent-a-Car defaults
-- ---------------------------------------------------------------------------

INSERT INTO public.business_settings (
  business_name,
  legal_name,
  logo_url,
  address,
  phone,
  whatsapp,
  email,
  currency,
  timezone,
  quote_terms,
  contract_terms,
  default_deposit,
  default_insurance,
  default_delivery_fee,
  policies
)
SELECT
  'OLDES Rent-a-Car',
  'OLDES Rent-a-Car',
  '/brand/oldes-logo.png',
  'San Antonio, San Miguel, El Salvador',
  '+503 0000-0000',
  '+503 0000-0000',
  'info@oldesrentacar.com',
  'USD',
  'America/El_Salvador',
  'Las tarifas incluyen kilometraje básico según políticas vigentes. El depósito es reembolsable al devolver el vehículo en las mismas condiciones.',
  'El arrendatario declara conocer y aceptar las condiciones del contrato de alquiler de vehículo. Documentación válida requerida.',
  200.00,
  15.00,
  25.00,
  jsonb_build_object(
    'min_rental_age', 21,
    'license_required', true,
    'fuel_policy', 'return_same_level',
    'cancellation_hours', 24
  )
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings LIMIT 1);
 
