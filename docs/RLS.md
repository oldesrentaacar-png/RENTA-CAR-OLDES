# Row Level Security (RLS) — Summary

**Última actualización:** 2026-07-27  
**Migration:** `supabase/migrations/20260327000008_rls_policies.sql`

---

## Principles

1. RLS **habilitado** en todas las tablas de aplicación.
2. Staff autenticado: `is_active_staff()` AND `has_permission(auth.uid(), 'key')`.
3. Anon: acceso mínimo; inserts sensibles **denegados**.
4. Service role (servidor): bypass RLS — solo en Route Handlers / jobs, nunca en browser.

---

## Helper functions

| Función | Propósito |
|---------|-----------|
| `is_active_staff()` | `profiles.status = 'ACTIVE'` |
| `has_permission(uid, key)` | RBAC efectivo |
| `get_user_permissions(uid)` | Lista de keys |
| `next_document_code(type)` | Numeradores (SECURITY DEFINER) |
| `insert_audit_log(...)` | Auditoría (SECURITY DEFINER) |

---

## Policy summary by area

### Roles & permissions

| Tabla | anon | authenticated |
|-------|------|---------------|
| `roles` | — | SELECT/INSERT/UPDATE/DELETE con `roles.manage` |
| `permissions` | — | SELECT con `roles.manage` OR `users.view` |
| `role_permissions` | — | ALL con `roles.manage` |
| `user_permission_overrides` | — | ALL con `roles.manage` |

### Profiles

| Operación | Regla |
|-----------|-------|
| SELECT own | `id = auth.uid()` |
| SELECT staff | `users.view` |
| INSERT | `users.create` |
| UPDATE own | `id = auth.uid()` |
| UPDATE staff | `users.edit` |

### Business settings

| Operación | Permiso |
|-----------|---------|
| SELECT | `settings.view` |
| INSERT/UPDATE | `settings.edit` |

`document_sequences`: **deny all** para clientes (usar RPC).

### Customers

CRUD según `customers.view/create/edit/delete`.

### Vehicles & images

| Operación | Regla |
|-----------|-------|
| Staff CRUD | `vehicles.*` keys |
| **anon SELECT** | Solo publicados: `published_on_web`, activos, no archivados, status no ARCHIVED/UNAVAILABLE |
| `vehicle_images` | Staff view/edit según permiso vehículos |

Vista `public_vehicles`: `GRANT SELECT TO anon, authenticated`.

### Web requests

| Rol | Acceso |
|-----|--------|
| authenticated | CRUD según `requests.*` |
| **anon** | **DENY ALL** — insert solo vía API con service role |

> Landing debe usar `POST /api/public/requests`, no insert directo.

### Quotes & reservations

- Quotes: `quotes.view/create/edit/delete`
- Quote items: view con `quotes.view`, mutate con `quotes.edit`
- Reservations: `reservations.view/create/edit`; cancel = `reservations.cancel`

### Contracts & signatures

- Contracts: `contracts.view/create/edit/cancel`
- Signatures insert: `contracts.sign`

### Inspections

- Parent: `inspections.view/create/edit`
- Checklist, photos, damage marks: view con `inspections.view`, write con `inspections.edit`

### Finance

| Tabla | Permisos |
|-------|----------|
| `income_transactions` | `finance.view/create/edit/delete` |
| `expense_transactions` | `finance.view/create/edit/delete` |

Sin `finance.view` → **0 filas** visibles vía anon/authenticated client.

### Maintenance

`maintenance.view/create/edit` en `maintenance_records`.

### Alerts

SELECT/INSERT/UPDATE con `dashboard.view`.

### Audit logs

| Operación | Regla |
|-----------|-------|
| SELECT | `audit.view` |
| INSERT client | **denied** (solo triggers SECURITY DEFINER) |

---

## Public access diagram

```
anon ──SELECT──► vehicles (published only)
anon ──SELECT──► public_vehicles (view)
anon ──X──────► web_requests (deny)
anon ──X──────► all staff tables (no policy = deny)

Next.js API (service role) ──INSERT──► web_requests
Next.js API (service role) ──SELECT──► vehicles (filtered)
```

---

## Testing RLS

### Test 7 — finance blocked without permission

1. Login como usuario **Recepción** (sin `finance.view`).
2. En SQL Editor con JWT del usuario (o Supabase client autenticado):

```javascript
const { data } = await supabase.from('income_transactions').select('*');
// data = [] (empty, not error)
```

3. Intentar insert → error RLS policy violation.

Ver [TESTING.md](./TESTING.md).

---

## Service role usage (allowed)

| Uso | Archivo |
|-----|---------|
| Public vehicles API | `src/app/api/public/vehicles/route.ts` |
| Public requests API | `src/app/api/public/requests/route.ts` |
| Admin bootstrap | `src/lib/supabase/admin.ts` |

**Nunca** exponer `SUPABASE_SERVICE_ROLE_KEY` en `NEXT_PUBLIC_*` ni en el browser.

---

## Related

- [RBAC.md](./RBAC.md)
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- [API.md](./API.md)
