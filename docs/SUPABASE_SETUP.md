# Supabase Setup — Rent A Car Pro

This guide covers creating the Supabase project, applying migrations, seeding development data, and provisioning the first administrator.

**Related:** [RLS.md](./RLS.md) · [RBAC.md](./RBAC.md) · [EXTERNAL_SERVICES.md](./EXTERNAL_SERVICES.md) · [TESTING.md](./TESTING.md)

---

## 1. Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Choose an organization, name (e.g. `rent-a-car-pro`), database password, and region close to El Salvador if available.
4. Wait for the project to finish provisioning.

Copy these values for `.env.local`:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role (secret) |

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser or commit it to Git.

---

## 2. Install Supabase CLI (optional but recommended)

```bash
npm install -g supabase
```

Link the local project:

```bash
cd "D:\CURSOR\PROYECTO RENTA CAR"
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the subdomain of your project URL (e.g. `abcdefghijklmnop` from `https://abcdefghijklmnop.supabase.co`).

---

## 3. Run migrations

### Option A — Supabase CLI

```bash
supabase db push
```

This applies all files in `supabase/migrations/` in timestamp order.

### Option B — SQL Editor (Dashboard)

1. Open **SQL Editor** in the Supabase Dashboard.
2. Run each migration file in order:
   - `20260327000001_extensions_and_enums.sql`
   - `20260327000002_core_rbac.sql`
   - `20260327000003_business_and_sequences.sql`
   - `20260327000004_customers_vehicles.sql`
   - `20260327000005_requests_quotes_reservations.sql`
   - `20260327000006_contracts_inspections.sql`
   - `20260327000007_finance_maintenance_alerts.sql`
   - `20260327000008_rls_policies.sql`
   - `20260327000009_seed_permissions_roles.sql`

---

## 4. Development seed (optional)

For sample customers, vehicles, requests, quotes, expenses, and maintenance:

```bash
# CLI
supabase db execute --file supabase/seed/dev_seed.sql

# Or paste supabase/seed/dev_seed.sql into the SQL Editor
```

This seed **does not** create auth users or passwords.

---

## 5. Create the first administrator

Staff accounts are **not** self-registered. An administrator must be provisioned manually.

### Step 5.1 — Create auth user

**Dashboard:** Authentication → Users → **Add user** → set email and password → confirm email if required.

**CLI:**

```bash
supabase auth admin create-user \
  --email admin@martinezrentacar.com \
  --password 'YourSecurePassword123!' \
  --email-confirm
```

Copy the user's **UUID** from the Dashboard or CLI output.

### Step 5.2 — Link profile to Administrador role

1. Open `supabase/seed/create_first_admin.sql`.
2. Replace placeholders:
   - `{{ADMIN_USER_ID}}` — UUID from Step 5.1
   - `{{ADMIN_EMAIL}}` — admin email
   - `{{ADMIN_FIRST_NAME}}` — e.g. `James`
   - `{{ADMIN_LAST_NAME}}` — e.g. `Note`
   - `{{ADMIN_PHONE}}` — optional phone, or leave empty `''`
3. Run the script in the SQL Editor.

Verify:

```sql
SELECT p.id, p.email, p.status, r.name AS role
FROM public.profiles p
JOIN public.roles r ON r.id = p.role_id
WHERE p.email = 'admin@martinezrentacar.com';
```

Test permissions:

```sql
SELECT public.has_permission('YOUR-USER-UUID'::uuid, 'finance.view');
-- Expected: true
```

---

## 6. Auth configuration

In **Authentication → Providers**:

- Enable **Email** provider.
- Disable public sign-ups if you want admin-only provisioning (**Authentication → Settings → Allow new users to sign up** → off).

Recommended redirect URLs (Project Settings → Authentication → URL configuration):

- Site URL: `http://localhost:3000` (dev) or your Vercel URL (prod)
- Redirect URLs: `http://localhost:3000/**`, `https://your-domain.com/**`

---

## 7. Storage buckets (Phase 2+)

Create private buckets for sensitive files:

| Bucket | Purpose |
|--------|---------|
| `contracts` | Contract PDFs |
| `signatures` | Digital signatures |
| `inspections` | Inspection photos |
| `receipts` | Expense/maintenance receipts |

Set all buckets to **private**. Use signed URLs from server-side code.

Vehicle public photos use **Cloudinary**, not Supabase Storage.

---

## 8. RLS and public API notes

- **Row Level Security** is enabled on all application tables.
- Permission checks use `public.has_permission(auth.uid(), 'permission.key')`.
- Staff must have `profiles.status = 'ACTIVE'`.
- **Landing web requests:** `POST /api/public/requests` must use the **service role** on the server. Anonymous direct insert to `web_requests` is denied by RLS.
- **Public vehicles:** `public.public_vehicles` view exposes safe fields. Anon can read published vehicles via RLS policy, or the Next.js API can use the service role with equivalent filters.

---

## 9. Document numbering

Codes are generated transactionally via `public.next_document_code(doc_type)`:

| Prefix | Entity |
|--------|--------|
| `SOL` | Web requests |
| `COT` | Quotes |
| `RES` | Reservations |
| `CTR` | Contracts |
| `INS` | Inspections |

Format: `COT-2026-000001` (year from `America/El_Salvador` timezone).

---

## 10. Reservation overlap protection

PostgreSQL exclusion constraint `reservations_no_overlap` prevents double-booking the same vehicle for overlapping dates. Cancelled and soft-deleted reservations are excluded.

If the app receives error `23P01`, show a user-friendly message such as: *"Este vehículo ya tiene una reserva entre estas fechas."*

---

## 11. Troubleshooting

| Issue | Solution |
|-------|----------|
| Migration fails on `btree_gist` | Enable in Dashboard → Database → Extensions, or run `CREATE EXTENSION btree_gist;` |
| User can log in but sees no data | Check `profiles.status = 'ACTIVE'` and role assignment |
| `has_permission` returns false | Verify role_permissions seed ran; check `roles.slug = 'administrador'` |
| Public vehicles empty | Set `published_on_web = true`, `is_active = true` on vehicles |
| Web request insert fails from Landing | Use service role in Next.js API route, not anon key |

---

## 12. Backups

- **Database:** Supabase Dashboard → Database → Backups (plan-dependent) or `pg_dump` via CLI.
- **Storage:** Export private buckets periodically.
- **Config:** Keep `.env.example` updated; store real secrets in Vercel/Supabase only.

---

## Migration file reference

| File | Contents |
|------|----------|
| `000001` | Extensions (`pgcrypto`, `btree_gist`) and all enums |
| `000002` | RBAC tables, profiles, triggers |
| `000003` | Business settings, document sequences, permission functions |
| `000004` | Customers, vehicles, images, `public_vehicles` view |
| `000005` | Web requests, quotes, reservations + overlap constraint |
| `000006` | Contracts, signatures, inspections |
| `000007` | Finance, maintenance, alerts, audit logs |
| `000008` | RLS policies on all tables |
| `000009` | Seed permissions, roles, business settings |
