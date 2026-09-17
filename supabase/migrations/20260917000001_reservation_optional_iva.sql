-- Optional IVA on reservations (parity with contracts). Default OFF.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS apply_iva boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(6, 4) NOT NULL DEFAULT 0.13,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.reservations.apply_iva IS
  'If true, reservation total includes tax_amount (IVA). Copied to contract when created.';
COMMENT ON COLUMN public.reservations.tax_rate IS
  'IVA rate as fraction (0.13 = 13%). Used only when apply_iva is true.';
COMMENT ON COLUMN public.reservations.tax_amount IS
  'IVA amount included in total when apply_iva is true.';
