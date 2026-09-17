-- Hardening: never collide on document codes / soft-deleted identity.
-- 1) next_document_code skips any code already present
-- 2) soft-delete archives codes/slugs so they stop blocking
-- 3) vehicles/vehicle_types unique only among active rows
-- 4) sync sequences to real max

-- ---------------------------------------------------------------------------
-- Collision-proof document codes (accepts p_doc_type OR p_sequence_type)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.next_document_code(text);

CREATE OR REPLACE FUNCTION public.next_document_code(
  p_doc_type text DEFAULT NULL,
  p_sequence_type text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_year int;
  v_next int;
  v_code text;
  v_exists boolean;
  v_attempts int := 0;
  v_max_existing int;
BEGIN
  v_type := upper(btrim(COALESCE(NULLIF(p_doc_type, ''), NULLIF(p_sequence_type, ''), '')));
  IF v_type = '' THEN
    RAISE EXCEPTION 'next_document_code: doc type required';
  END IF;

  v_year := EXTRACT(
    YEAR FROM (now() AT TIME ZONE 'America/El_Salvador')
  )::int;

  -- Align sequence with highest numeric suffix already stored for this type/year
  SELECT COALESCE(MAX(
    substring(code from '([0-9]+)$')::int
  ), 0)
  INTO v_max_existing
  FROM (
    SELECT code FROM public.quotes WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+$')
    UNION ALL
    SELECT code FROM public.contracts WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+$')
    UNION ALL
    SELECT code FROM public.reservations WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+$')
    UNION ALL
    SELECT code FROM public.web_requests WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+$')
    UNION ALL
    SELECT code FROM public.payment_receipts WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+$')
    UNION ALL
    SELECT code FROM public.inspections WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+$')
  ) x;

  INSERT INTO public.document_sequences (doc_type, year, last_value)
  VALUES (v_type, v_year, GREATEST(v_max_existing, 0))
  ON CONFLICT (doc_type, year)
  DO UPDATE SET last_value = GREATEST(public.document_sequences.last_value, EXCLUDED.last_value);

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 1000 THEN
      RAISE EXCEPTION 'No se pudo generar un código único para %', v_type;
    END IF;

    INSERT INTO public.document_sequences (doc_type, year, last_value)
    VALUES (v_type, v_year, 1)
    ON CONFLICT (doc_type, year)
    DO UPDATE SET last_value = public.document_sequences.last_value + 1
    RETURNING last_value INTO v_next;

    v_code := v_type || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

    CASE v_type
      WHEN 'COT' THEN
        SELECT EXISTS(SELECT 1 FROM public.quotes WHERE code = v_code) INTO v_exists;
      WHEN 'CTR' THEN
        SELECT EXISTS(SELECT 1 FROM public.contracts WHERE code = v_code) INTO v_exists;
      WHEN 'RES' THEN
        SELECT EXISTS(SELECT 1 FROM public.reservations WHERE code = v_code) INTO v_exists;
      WHEN 'SOL' THEN
        SELECT EXISTS(SELECT 1 FROM public.web_requests WHERE code = v_code) INTO v_exists;
      WHEN 'REC', 'DEV' THEN
        SELECT EXISTS(SELECT 1 FROM public.payment_receipts WHERE code = v_code) INTO v_exists;
      WHEN 'INS' THEN
        SELECT EXISTS(SELECT 1 FROM public.inspections WHERE code = v_code) INTO v_exists;
      ELSE
        v_exists := false;
    END CASE;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_document_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_code(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Archive identity on soft-delete so UNIQUE no longer blocks recreating
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_identity_on_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_suffix text;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_suffix := substr(replace(NEW.id::text, '-', ''), 1, 8);

    IF TG_ARGV[0] = 'code'
       AND NEW.code IS NOT NULL
       AND position('__del__' in NEW.code) = 0 THEN
      NEW.code := NEW.code || '__del__' || v_suffix;
    END IF;

    IF TG_ARGV[0] = 'slug'
       AND NEW.slug IS NOT NULL
       AND position('-del-' in NEW.slug) = 0 THEN
      NEW.slug := left(NEW.slug, 80) || '-del-' || v_suffix;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_archive_code ON public.quotes;
CREATE TRIGGER trg_quotes_archive_code
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('code');

DROP TRIGGER IF EXISTS trg_contracts_archive_code ON public.contracts;
CREATE TRIGGER trg_contracts_archive_code
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('code');

DROP TRIGGER IF EXISTS trg_reservations_archive_code ON public.reservations;
CREATE TRIGGER trg_reservations_archive_code
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('code');

DROP TRIGGER IF EXISTS trg_web_requests_archive_code ON public.web_requests;
CREATE TRIGGER trg_web_requests_archive_code
  BEFORE UPDATE ON public.web_requests
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('code');

DROP TRIGGER IF EXISTS trg_payment_receipts_archive_code ON public.payment_receipts;
CREATE TRIGGER trg_payment_receipts_archive_code
  BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('code');

DROP TRIGGER IF EXISTS trg_vehicles_archive_slug ON public.vehicles;
CREATE TRIGGER trg_vehicles_archive_slug
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('slug');

DROP TRIGGER IF EXISTS trg_vehicle_types_archive_slug ON public.vehicle_types;
CREATE TRIGGER trg_vehicle_types_archive_slug
  BEFORE UPDATE ON public.vehicle_types
  FOR EACH ROW EXECUTE FUNCTION public.archive_identity_on_soft_delete('slug');

-- One-time: free codes/slugs already soft-deleted
UPDATE public.quotes
SET code = code || '__del__' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('__del__' in code) = 0;

UPDATE public.contracts
SET code = code || '__del__' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('__del__' in code) = 0;

UPDATE public.reservations
SET code = code || '__del__' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('__del__' in code) = 0;

UPDATE public.web_requests
SET code = code || '__del__' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('__del__' in code) = 0;

UPDATE public.payment_receipts
SET code = code || '__del__' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('__del__' in code) = 0;

UPDATE public.vehicles
SET slug = left(slug, 80) || '-del-' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('-del-' in slug) = 0;

UPDATE public.vehicle_types
SET slug = left(slug, 80) || '-del-' || substr(replace(id::text, '-', ''), 1, 8)
WHERE deleted_at IS NOT NULL AND position('-del-' in slug) = 0;

-- ---------------------------------------------------------------------------
-- Active-only uniqueness for vehicles / vehicle types
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_slug_key;
DROP INDEX IF EXISTS public.vehicles_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_slug_active
  ON public.vehicles (slug)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_plate_active
  ON public.vehicles (upper(btrim(plate)))
  WHERE deleted_at IS NULL
    AND plate IS NOT NULL
    AND btrim(plate) <> ''
    AND upper(btrim(plate)) NOT IN (
      'N/A', 'NA', 'S/N', 'SN', '-', 'PENDING', 'PENDIENTE', 'TBD'
    );

ALTER TABLE public.vehicle_types DROP CONSTRAINT IF EXISTS vehicle_types_slug_key;
DROP INDEX IF EXISTS public.vehicle_types_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_types_slug_active
  ON public.vehicle_types (slug)
  WHERE deleted_at IS NULL;
