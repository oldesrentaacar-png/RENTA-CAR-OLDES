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
