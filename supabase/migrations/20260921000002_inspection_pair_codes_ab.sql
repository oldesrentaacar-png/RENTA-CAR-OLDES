-- Inspection pair codes: INS-YYYY-NNNNNNA (salida) / …B (entrada).
-- Align sequence extraction and collision checks with optional A/B suffix.

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

  -- Align sequence with highest numeric suffix (INS may end with A/B)
  SELECT COALESCE(MAX(
    CASE
      WHEN v_type = 'INS' THEN
        substring(code from '-([0-9]+)[AB]?$')::int
      ELSE
        substring(code from '([0-9]+)$')::int
    END
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
    SELECT code FROM public.inspections
      WHERE code ~ ('^' || v_type || '-' || v_year::text || '-[0-9]+[AB]?$')
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
        SELECT EXISTS(
          SELECT 1 FROM public.inspections
          WHERE code = v_code
             OR code = v_code || 'A'
             OR code = v_code || 'B'
        ) INTO v_exists;
      ELSE
        v_exists := false;
    END CASE;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;
