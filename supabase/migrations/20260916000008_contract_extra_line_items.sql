-- Free-form billing lines on contracts (extras sueltos beyond quote).
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS extra_line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contracts.extra_line_items IS
  'Array of {label, amount} extras added manually on the contract (not from quote).';
