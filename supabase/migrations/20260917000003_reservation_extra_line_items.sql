-- Named billable extras on reservations (same shape as contracts.extra_line_items).
-- Keeps quote → reservation → contract line items aligned (silla bebé, GPS, etc.).

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS extra_line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.reservations.extra_line_items IS
  'Named billable extras [{label, amount}]. Sum should match additional_costs.';
