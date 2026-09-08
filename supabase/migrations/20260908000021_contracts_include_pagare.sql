-- Optional pagaré override per contract (null = auto from customer docs).
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS include_pagare boolean;

COMMENT ON COLUMN public.contracts.include_pagare IS
  'NULL = auto (DUI/local), TRUE = force include, FALSE = force exclude from PDF.';
