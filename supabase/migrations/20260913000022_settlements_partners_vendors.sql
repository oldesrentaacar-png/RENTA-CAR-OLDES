-- Liquidación, sub-renta/socios, proveedores, cliente bloqueado
-- Migration: 20260913000022

-- ---------------------------------------------------------------------------
-- Cliente bloqueado
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_customers_is_blocked
  ON public.customers (is_blocked)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.customers.is_blocked IS
  'Si true, no se debe volver a alquilar a este cliente.';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.partner_rental_status AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'BLOCKED',
    'ANNULLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vendor_ledger_kind AS ENUM (
    'CHARGE',
    'PAYMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vendors_name
  ON public.vendors (name)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Liquidación mensual (cuentas a cancelar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  contract_code text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_label text,
  plate text,
  start_at timestamptz,
  end_at timestamptz,
  rental_days integer,
  billed_amount numeric(12,2) NOT NULL DEFAULT 0,
  payments_received numeric(12,2) NOT NULL DEFAULT 0,
  oldes_cost numeric(12,2) NOT NULL DEFAULT 0,
  provider_cost numeric(12,2) NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  extra_costs numeric(12,2) NOT NULL DEFAULT 0,
  own_profit numeric(12,2) NOT NULL DEFAULT 0,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_monthly_settlements_period
  ON public.monthly_settlements (period_month)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_settlements_contract
  ON public.monthly_settlements (contract_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_settlements_vendor
  ON public.monthly_settlements (vendor_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Sub-renta / socios
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_label text,
  plate text,
  start_date date,
  end_date date,
  client_charged numeric(12,2) NOT NULL DEFAULT 0,
  partner_share numeric(12,2) NOT NULL DEFAULT 0,
  own_share numeric(12,2) NOT NULL DEFAULT 0,
  status public.partner_rental_status NOT NULL DEFAULT 'IN_PROGRESS',
  paid_by_client boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_partner_rentals_status
  ON public.partner_rentals (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_rentals_dates
  ON public.partner_rentals (start_date, end_date)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Libro de proveedores (debo / pagado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  kind public.vendor_ledger_kind NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  concept text NOT NULL,
  settlement_id uuid REFERENCES public.monthly_settlements(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor
  ON public.vendor_ledger_entries (vendor_id, entry_date)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS (finance.*)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendors_select ON public.vendors;
CREATE POLICY vendors_select ON public.vendors
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

DROP POLICY IF EXISTS vendors_insert ON public.vendors;
CREATE POLICY vendors_insert ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

DROP POLICY IF EXISTS vendors_update ON public.vendors;
CREATE POLICY vendors_update ON public.vendors
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

DROP POLICY IF EXISTS vendors_delete ON public.vendors;
CREATE POLICY vendors_delete ON public.vendors
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

DROP POLICY IF EXISTS settlements_select ON public.monthly_settlements;
CREATE POLICY settlements_select ON public.monthly_settlements
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

DROP POLICY IF EXISTS settlements_insert ON public.monthly_settlements;
CREATE POLICY settlements_insert ON public.monthly_settlements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

DROP POLICY IF EXISTS settlements_update ON public.monthly_settlements;
CREATE POLICY settlements_update ON public.monthly_settlements
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

DROP POLICY IF EXISTS settlements_delete ON public.monthly_settlements;
CREATE POLICY settlements_delete ON public.monthly_settlements
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

DROP POLICY IF EXISTS partner_rentals_select ON public.partner_rentals;
CREATE POLICY partner_rentals_select ON public.partner_rentals
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

DROP POLICY IF EXISTS partner_rentals_insert ON public.partner_rentals;
CREATE POLICY partner_rentals_insert ON public.partner_rentals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

DROP POLICY IF EXISTS partner_rentals_update ON public.partner_rentals;
CREATE POLICY partner_rentals_update ON public.partner_rentals
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

DROP POLICY IF EXISTS partner_rentals_delete ON public.partner_rentals;
CREATE POLICY partner_rentals_delete ON public.partner_rentals
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));

DROP POLICY IF EXISTS vendor_ledger_select ON public.vendor_ledger_entries;
CREATE POLICY vendor_ledger_select ON public.vendor_ledger_entries
  FOR SELECT TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.view'));

DROP POLICY IF EXISTS vendor_ledger_insert ON public.vendor_ledger_entries;
CREATE POLICY vendor_ledger_insert ON public.vendor_ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.create'));

DROP POLICY IF EXISTS vendor_ledger_update ON public.vendor_ledger_entries;
CREATE POLICY vendor_ledger_update ON public.vendor_ledger_entries
  FOR UPDATE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'))
  WITH CHECK (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.edit'));

DROP POLICY IF EXISTS vendor_ledger_delete ON public.vendor_ledger_entries;
CREATE POLICY vendor_ledger_delete ON public.vendor_ledger_entries
  FOR DELETE TO authenticated
  USING (public.is_active_staff() AND public.has_permission(auth.uid(), 'finance.delete'));
