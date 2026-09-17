-- Bulletproof signature writes: never fail with duplicate (contract_id, signer_type).

CREATE OR REPLACE FUNCTION public.upsert_contract_signature(
  p_contract_id uuid,
  p_signer_type public.signer_type,
  p_signed_by_name text,
  p_signature_path text,
  p_signed_by_user_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_contract_id IS NULL OR p_signer_type IS NULL THEN
    RAISE EXCEPTION 'contract_id and signer_type are required';
  END IF;
  IF p_signed_by_name IS NULL OR btrim(p_signed_by_name) = '' THEN
    RAISE EXCEPTION 'signed_by_name is required';
  END IF;
  IF p_signature_path IS NULL OR btrim(p_signature_path) = '' THEN
    RAISE EXCEPTION 'signature_path is required';
  END IF;

  INSERT INTO public.contract_signatures (
    contract_id,
    signer_type,
    signed_by_name,
    signed_by_user_id,
    signature_path,
    ip_address,
    user_agent,
    signed_at
  )
  VALUES (
    p_contract_id,
    p_signer_type,
    btrim(p_signed_by_name),
    p_signed_by_user_id,
    p_signature_path,
    p_ip_address,
    p_user_agent,
    now()
  )
  ON CONFLICT (contract_id, signer_type)
  DO UPDATE SET
    signed_by_name = EXCLUDED.signed_by_name,
    signed_by_user_id = COALESCE(EXCLUDED.signed_by_user_id, public.contract_signatures.signed_by_user_id),
    signature_path = EXCLUDED.signature_path,
    ip_address = COALESCE(EXCLUDED.ip_address, public.contract_signatures.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, public.contract_signatures.user_agent),
    signed_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_contract_signature(
  uuid, public.signer_type, text, text, uuid, inet, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_contract_signature(
  uuid, public.signer_type, text, text, uuid, inet, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_contract_signature(
  uuid, public.signer_type, text, text, uuid, inet, text
) TO service_role;
