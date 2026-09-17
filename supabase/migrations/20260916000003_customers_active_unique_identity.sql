-- Unique identity only among ACTIVE customers.
-- Soft-deleted rows never block re-creating the same phone/email/DUI/NIT.

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_phone_active
  ON public.customers (phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL AND btrim(phone) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email_active
  ON public.customers (lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_dui_active
  ON public.customers (dui)
  WHERE deleted_at IS NULL AND dui IS NOT NULL AND btrim(dui) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_nit_active
  ON public.customers (nit)
  WHERE deleted_at IS NULL AND nit IS NOT NULL AND btrim(nit) <> '';
