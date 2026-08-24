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
