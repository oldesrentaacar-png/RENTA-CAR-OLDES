-- Soft link from partner sub-rentas to contracts (lookup only; money stays in partner_rentals).
ALTER TABLE public.partner_rentals
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_code text;

CREATE INDEX IF NOT EXISTS idx_partner_rentals_contract
  ON public.partner_rentals (contract_id)
  WHERE deleted_at IS NULL AND contract_id IS NOT NULL;
