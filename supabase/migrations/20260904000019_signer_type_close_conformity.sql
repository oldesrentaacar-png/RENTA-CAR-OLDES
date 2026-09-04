-- Close-conformity signature (end-of-rental declaration), separate from opening CLIENT sign.
DO $$
BEGIN
  ALTER TYPE public.signer_type ADD VALUE 'CLOSE_CONFORMITY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
