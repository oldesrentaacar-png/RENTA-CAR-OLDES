-- OLDES client feedback v1.2 — subarriendo, cortesías, inspección entrega/recibe
-- Migration: 20260817000012

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS sublease_daily_cost numeric(12, 2),
  ADD COLUMN IF NOT EXISTS sublease_payee_name text;

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS handover_person_name text,
  ADD COLUMN IF NOT EXISTS additional_driver_name text;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS courtesy_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courtesy_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_return_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_extra_days_waived integer NOT NULL DEFAULT 0;

UPDATE public.business_settings
SET policies = COALESCE(policies, '{}'::jsonb) || jsonb_build_object('extraDayGraceHours', 2)
WHERE NOT (COALESCE(policies, '{}'::jsonb) ? 'extraDayGraceHours');
