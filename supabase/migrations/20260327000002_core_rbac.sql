-- Rent A Car Pro — Core RBAC (roles, permissions, profiles)
-- Migration: 20260327000002

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

CREATE TABLE public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roles_slug ON public.roles (slug);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

CREATE TABLE public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  module      text NOT NULL,
  description text
);

CREATE INDEX idx_permissions_module ON public.permissions (module);
CREATE INDEX idx_permissions_key ON public.permissions (key);

-- ---------------------------------------------------------------------------
-- Role ↔ Permission
-- ---------------------------------------------------------------------------

CREATE TABLE public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission ON public.role_permissions (permission_id);

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name    text,
  last_name     text,
  email         text,
  phone         text,
  avatar_url    text,
  role_id       uuid REFERENCES public.roles (id) ON DELETE SET NULL,
  status        public.user_status NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role_id ON public.profiles (role_id);
CREATE INDEX idx_profiles_status ON public.profiles (status);
CREATE INDEX idx_profiles_email ON public.profiles (email);

-- ---------------------------------------------------------------------------
-- Per-user permission overrides
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_permission_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  effect        public.permission_effect NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX idx_user_permission_overrides_user ON public.user_permission_overrides (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional: profile bootstrap on auth signup
-- Profiles for staff are normally created by an administrator via the dashboard.
-- Uncomment the trigger below if you want a minimal profile row on every signup.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    'INACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- NOT enabled by default — staff accounts are provisioned by admin:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Optional: last login tracking (call from app on successful login)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_last_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = now()
  WHERE id = p_user_id;
END;
$$;
