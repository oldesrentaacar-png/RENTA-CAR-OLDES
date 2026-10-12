-- Commercial discount (percent + USD) on reservations and contracts.
-- Same rule as quotes: percent applies to tarifa × días + seguro + extras, before IVA.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS discount_percent numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS discount_percent numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.reservations.discount_percent IS
  'Commercial discount percent 0-100. When > 0 it wins over discount_amount.';
COMMENT ON COLUMN public.reservations.discount_amount IS
  'Commercial discount in USD, calculated from the percent or entered as a fixed amount.';
COMMENT ON COLUMN public.contracts.discount_percent IS
  'Commercial discount percent copied from the reservation.';
COMMENT ON COLUMN public.contracts.discount_amount IS
  'Commercial discount in USD copied from the reservation.';
