-- Devoluciones / notas de crédito compartibles (mismo flujo que abonos)
-- Migration: 20260817000013

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payment_receipt_kind'
  ) THEN
    CREATE TYPE public.payment_receipt_kind AS ENUM ('PAYMENT', 'REFUND');
  END IF;
END $$;

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS receipt_kind public.payment_receipt_kind NOT NULL DEFAULT 'PAYMENT';

INSERT INTO public.document_sequences (doc_type, year, last_value)
SELECT 'DEV', EXTRACT(YEAR FROM CURRENT_DATE)::int, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_sequences
  WHERE doc_type = 'DEV'
    AND year = EXTRACT(YEAR FROM CURRENT_DATE)::int
);

CREATE OR REPLACE FUNCTION public.set_payment_receipt_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    IF NEW.receipt_kind = 'REFUND' THEN
      NEW.code := public.next_document_code('DEV');
    ELSE
      NEW.code := public.next_document_code('REC');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_receipts_code ON public.payment_receipts;
CREATE TRIGGER trg_payment_receipts_code
  BEFORE INSERT ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_receipt_code();
