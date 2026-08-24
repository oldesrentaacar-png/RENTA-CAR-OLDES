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
