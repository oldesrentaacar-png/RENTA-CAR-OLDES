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

