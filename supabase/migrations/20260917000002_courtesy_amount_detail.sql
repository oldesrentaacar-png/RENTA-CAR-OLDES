-- Manual courtesy discount (admin-only in UI): amount + detail notes.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS courtesy_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courtesy_detail text;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS courtesy_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courtesy_detail text;

COMMENT ON COLUMN public.reservations.courtesy_amount IS
  'Admin courtesy discount in USD (hours/days that do not fit billing). Subtracted from pretax total.';
COMMENT ON COLUMN public.reservations.courtesy_detail IS
  'Free-text justification for courtesy discount (who authorized, hours waived, etc.).';
COMMENT ON COLUMN public.contracts.courtesy_amount IS
  'Admin courtesy discount in USD. Subtracted from pretax total / close billing.';
COMMENT ON COLUMN public.contracts.courtesy_detail IS
  'Free-text justification for courtesy discount.';
