-- Rent A Car Pro — Create first administrator
-- Template: replace placeholders before running.
--
-- Prerequisites:
--   1. All migrations applied (including seed_permissions_roles).
--   2. Auth user created in Supabase Dashboard or CLI (see below).
--
-- ---------------------------------------------------------------------------
-- STEP 1: Create auth user (choose one method)
-- ---------------------------------------------------------------------------
--
-- Option A — Supabase Dashboard:
--   Authentication → Users → Add user → set email + password
--   Copy the generated UUID.
--
-- Option B — Supabase CLI:
--   supabase auth admin create-user \
--     --email {{ADMIN_EMAIL}} \
--     --password '{{ADMIN_PASSWORD}}' \
--     --email-confirm
--
-- Option C — SQL (requires service role / direct DB access):
--   Use Supabase Auth Admin API from your app instead of raw SQL for passwords.
--
-- ---------------------------------------------------------------------------
-- STEP 2: Replace placeholders and run this script
-- ---------------------------------------------------------------------------

-- {{ADMIN_USER_ID}}     — UUID from auth.users (required)
-- {{ADMIN_EMAIL}}       — admin email (required)
-- {{ADMIN_FIRST_NAME}}  — e.g. James
-- {{ADMIN_LAST_NAME}}   — e.g. Note
-- {{ADMIN_PHONE}}       — optional, e.g. +503 0000-0000

DO $$
DECLARE
  v_user_id uuid := '{{ADMIN_USER_ID}}'::uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE slug = 'administrador' LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role administrador not found. Run migrations first.';
  END IF;

  -- Upsert profile linked to auth.users
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    phone,
    role_id,
    status
  ) VALUES (
    v_user_id,
    '{{ADMIN_FIRST_NAME}}',
    '{{ADMIN_LAST_NAME}}',
    '{{ADMIN_EMAIL}}',
    NULLIF('{{ADMIN_PHONE}}', ''),
    v_role_id,
    'ACTIVE'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    email      = EXCLUDED.email,
    phone      = COALESCE(EXCLUDED.phone, profiles.phone),
    role_id    = EXCLUDED.role_id,
    status     = 'ACTIVE',
    updated_at = now();

  RAISE NOTICE 'Administrator profile created/updated for user %', v_user_id;
END $$;

-- Verify:
-- SELECT p.*, r.name AS role_name
-- FROM public.profiles p
-- JOIN public.roles r ON r.id = p.role_id
-- WHERE p.id = '{{ADMIN_USER_ID}}'::uuid;

-- Test permission (as that user via JWT):
-- SELECT public.has_permission('{{ADMIN_USER_ID}}'::uuid, 'finance.view');
