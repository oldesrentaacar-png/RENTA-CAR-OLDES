-- Allow promissory-note (pagaré) as a separate signature from the lease contract.
DO $$
BEGIN
  ALTER TYPE public.signer_type ADD VALUE 'PAGARE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.signer_type IS
  'CLIENT / REPRESENTATIVE = lease contract; PAGARE = separate mercantil promissory note (local clients).';
