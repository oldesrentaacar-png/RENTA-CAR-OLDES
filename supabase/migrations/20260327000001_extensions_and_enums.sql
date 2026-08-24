-- Rent A Car Pro — Extensions and enums
-- Migration: 20260327000001

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);

CREATE TYPE public.permission_effect AS ENUM (
  'GRANT',
  'DENY'
);

CREATE TYPE public.ownership_type AS ENUM (
  'OWN',
  'THIRD_PARTY',
  'SUBLEASED',
  'CONSIGNMENT'
);

CREATE TYPE public.vehicle_status AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'MAINTENANCE',
  'UNAVAILABLE',
  'ARCHIVED'
);

CREATE TYPE public.web_request_status AS ENUM (
  'PENDING',
  'CONTACTED',
  'QUOTED',
  'CONVERTED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE public.web_request_source AS ENUM (
  'WEBSITE',
  'PHONE',
  'WHATSAPP',
  'WALK_IN',
  'OTHER'
);

CREATE TYPE public.quote_status AS ENUM (
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE public.reservation_status AS ENUM (
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.contract_status AS ENUM (
  'PENDING',
  'CLIENT_SIGNED',
  'REPRESENTATIVE_SIGNED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.signer_type AS ENUM (
  'CLIENT',
  'REPRESENTATIVE'
);

CREATE TYPE public.inspection_type AS ENUM (
  'CHECK_OUT',
  'CHECK_IN'
);

CREATE TYPE public.checklist_item_status AS ENUM (
  'OK',
  'DAMAGED',
  'MISSING',
  'NOT_APPLICABLE'
);

CREATE TYPE public.damage_type AS ENUM (
  'SCRATCH',
  'DENT',
  'CRACK',
  'PAINT',
  'BROKEN',
  'OTHER'
);

CREATE TYPE public.damage_severity AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE public.vehicle_view AS ENUM (
  'TOP',
  'FRONT',
  'REAR',
  'LEFT',
  'RIGHT'
);

CREATE TYPE public.inspection_photo_category AS ENUM (
  'FRONT',
  'REAR',
  'LEFT',
  'RIGHT',
  'INTERIOR',
  'DASHBOARD',
  'WHEELS',
  'DAMAGE',
  'OTHER'
);

CREATE TYPE public.income_type AS ENUM (
  'RENTAL',
  'DEPOSIT',
  'INSURANCE',
  'EXTRA',
  'OTHER'
);

CREATE TYPE public.deposit_status AS ENUM (
  'RECEIVED',
  'HELD',
  'RETURNED',
  'APPLIED',
  'PARTIALLY_APPLIED'
);

CREATE TYPE public.payment_method AS ENUM (
  'CASH',
  'TRANSFER',
  'CARD',
  'OTHER'
);

CREATE TYPE public.expense_category AS ENUM (
  'MAINTENANCE',
  'FUEL',
  'INSURANCE',
  'STAFF',
  'ADVERTISING',
  'WASH',
  'PARTS',
  'COMMISSIONS',
  'FINES',
  'OTHER'
);

CREATE TYPE public.maintenance_type AS ENUM (
  'OIL',
  'BRAKES',
  'TIRES',
  'ENGINE',
  'TRANSMISSION',
  'AC',
  'ELECTRICAL',
  'BODY',
  'GENERAL',
  'OTHER'
);

CREATE TYPE public.maintenance_status AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE public.fuel_level AS ENUM (
  'EMPTY',
  'QUARTER',
  'HALF',
  'THREE_QUARTERS',
  'FULL'
);
