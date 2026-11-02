-- Residuos de 2¢ (58.66 × 3 = 175.98 vs trato de 176) no son deuda ni saldo a favor.

UPDATE public.contracts
SET
  payment_status = CASE
    WHEN COALESCE(amount_paid, 0) > 0 THEN 'PAID'
    ELSE payment_status
  END,
  balance_due = 0
WHERE deleted_at IS NULL
  AND ABS(COALESCE(balance_due, 0)) > 0
  AND ABS(COALESCE(balance_due, 0)) <= 0.02;

UPDATE public.contracts
SET
  subtotal = CASE
    WHEN subtotal IS NOT NULL AND ABS(subtotal - total) <= 0.02 THEN ROUND(total)
    ELSE subtotal
  END,
  balance_due = CASE
    WHEN ABS(COALESCE(balance_due, 0) - total) <= 0.02 THEN ROUND(total)
    ELSE balance_due
  END,
  total = ROUND(total)
WHERE deleted_at IS NULL
  AND ABS(total - ROUND(total)) > 0
  AND ABS(total - ROUND(total)) <= 0.02;

UPDATE public.contracts
SET
  payment_status = CASE
    WHEN COALESCE(amount_paid, 0) > 0 THEN 'PAID'
    ELSE payment_status
  END,
  balance_due = 0
WHERE deleted_at IS NULL
  AND ABS(COALESCE(balance_due, 0)) > 0
  AND ABS(COALESCE(balance_due, 0)) <= 0.02;

UPDATE public.reservations
SET total = ROUND(total)
WHERE deleted_at IS NULL
  AND ABS(total - ROUND(total)) > 0
  AND ABS(total - ROUND(total)) <= 0.02;

CREATE OR REPLACE FUNCTION public.settle_contract_cent_residuals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snapped numeric(12, 2);
BEGIN
  IF NEW.total IS NOT NULL AND ABS(NEW.total - ROUND(NEW.total)) <= 0.02 THEN
    snapped := ROUND(NEW.total);
    IF NEW.subtotal IS NOT NULL AND ABS(NEW.subtotal - NEW.total) <= 0.02 THEN
      NEW.subtotal := snapped;
    END IF;
    IF NEW.balance_due IS NOT NULL AND ABS(NEW.balance_due - NEW.total) <= 0.02 THEN
      NEW.balance_due := snapped;
    END IF;
    NEW.total := snapped;
  END IF;

  IF NEW.balance_due IS NOT NULL AND ABS(NEW.balance_due) <= 0.02 THEN
    NEW.balance_due := 0;
    IF COALESCE(NEW.amount_paid, 0) > 0 THEN
      NEW.payment_status := 'PAID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settle_contract_cent_residuals ON public.contracts;
CREATE TRIGGER trg_settle_contract_cent_residuals
BEFORE INSERT OR UPDATE OF total, subtotal, balance_due, amount_paid, payment_status
ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.settle_contract_cent_residuals();
