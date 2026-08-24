# RBAC — Roles and Permissions

**Última actualización:** 2026-07-27

---

## Overview

Rent A Car Pro usa RBAC (Role-Based Access Control) con:

- Catálogo de **permissions** (keys estables).
- **Roles** configurables con asignación M:N.
- **Overrides** por usuario (grant/deny).

Resolución efectiva:

```
permisos_efectivos = (role_permissions ∪ grants) − denies
```

Implementación SQL: `public.has_permission(user_id, 'permission.key')`  
Implementación TS: `src/lib/auth/permissions.ts`

---

## User states

| Estado | Acceso |
|--------|--------|
| `ACTIVE` | Staff operativo |
| `INACTIVE` | Sin acceso |
| `SUSPENDED` | Sin acceso |

Solo usuarios `ACTIVE` pasan `is_active_staff()` en RLS.

---

## System roles

| Rol | Slug | Descripción |
|-----|------|-------------|
| Administrador | `administrador` | Acceso total |
| Gerente | `gerente` | Operación + reportes; sin admin de usuarios/roles |
| Recepción | `recepcion` | Atención diaria, cotizaciones, reservas |
| Empleado | `empleado` | Solo lectura operativa |
| Contabilidad | `contabilidad` | Finanzas + reportes + lectura operativa |
| Mantenimiento | `mantenimiento` | Flota, mantenimiento, inspecciones |

Seed: `supabase/migrations/20260327000009_seed_permissions_roles.sql`

---

## Permission catalog

### Dashboard

| Key | Descripción |
|-----|-------------|
| `dashboard.view` | Ver panel y alertas |

### Requests (solicitudes web)

| Key | Descripción |
|-----|-------------|
| `requests.view` | Ver solicitudes |
| `requests.create` | Crear manualmente |
| `requests.edit` | Editar |
| `requests.delete` | Eliminar |

### Customers

| Key | Descripción |
|-----|-------------|
| `customers.view` | Ver |
| `customers.create` | Crear |
| `customers.edit` | Editar |
| `customers.delete` | Eliminar |

### Quotes

| Key | Descripción |
|-----|-------------|
| `quotes.view` | Ver |
| `quotes.create` | Crear |
| `quotes.edit` | Editar |
| `quotes.delete` | Eliminar |
| `quotes.send` | Enviar al cliente |
| `quotes.accept` | Aceptar/rechazar |

### Reservations

| Key | Descripción |
|-----|-------------|
| `reservations.view` | Ver |
| `reservations.create` | Crear |
| `reservations.edit` | Editar |
| `reservations.cancel` | Cancelar |

### Vehicles

| Key | Descripción |
|-----|-------------|
| `vehicles.view` | Ver flota |
| `vehicles.create` | Crear |
| `vehicles.edit` | Editar |
| `vehicles.archive` | Archivar |
| `vehicles.publish` | Publicar en web |

### Contracts

| Key | Descripción |
|-----|-------------|
| `contracts.view` | Ver |
| `contracts.create` | Crear |
| `contracts.edit` | Editar |
| `contracts.sign` | Firmar |
| `contracts.cancel` | Cancelar |

### Inspections

| Key | Descripción |
|-----|-------------|
| `inspections.view` | Ver |
| `inspections.create` | Crear |
| `inspections.edit` | Editar |

### Finance

| Key | Descripción |
|-----|-------------|
| `finance.view` | Ver finanzas |
| `finance.create` | Registrar ingresos/gastos |
| `finance.edit` | Editar transacciones |
| `finance.delete` | Eliminar transacciones |

### Maintenance

| Key | Descripción |
|-----|-------------|
| `maintenance.view` | Ver |
| `maintenance.create` | Crear |
| `maintenance.edit` | Editar |

### Reports

| Key | Descripción |
|-----|-------------|
| `reports.view` | Ver reportes |
| `reports.export` | Exportar |

### Users & roles

| Key | Descripción |
|-----|-------------|
| `users.view` | Ver usuarios |
| `users.create` | Crear |
| `users.edit` | Editar |
| `users.disable` | Desactivar |
| `roles.manage` | Administrar roles y permisos |

### Settings & audit

| Key | Descripción |
|-----|-------------|
| `settings.view` | Ver configuración |
| `settings.edit` | Editar configuración |
| `audit.view` | Ver auditoría |

---

## Role → permission matrix (summary)

| Área | Admin | Gerente | Recepción | Empleado | Contabilidad | Mantenimiento |
|------|:-----:|:-------:|:---------:|:--------:|:------------:|:-------------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Operación (CRUD) | ✓ | ✓ | parcial | read | read | — |
| Finanzas | ✓ | ✓ | — | — | ✓ | — |
| Reportes export | ✓ | ✓ | — | — | ✓ | — |
| Usuarios/Roles | ✓ | — | — | — | — | — |
| Mantenimiento | ✓ | ✓ | — | — | — | ✓ |

Detalle exacto en migración seed.

---

## User permission overrides

Tabla: `user_permission_overrides`

| Campo | Descripción |
|-------|-------------|
| `user_id` | UUID del profile |
| `permission_id` | FK a `permissions` |
| `granted` | `true` = grant extra; `false` = deny explícito |

Gestión UI: `/dashboard/usuarios/[id]/edit` (requiere `roles.manage` para overrides).

Deny gana sobre el rol.

---

## Enforcement in app

| Capa | Mecanismo |
|------|-----------|
| Sidebar | `filterNavByPermissions()` en `nav-config.ts` |
| Páginas | Layout dashboard + checks server-side |
| Mutaciones | `requirePermission()` en Server Actions |
| BD | RLS con `has_permission()` |

---

## Verify permissions (SQL)

```sql
SELECT public.has_permission('USER-UUID'::uuid, 'finance.view');
SELECT * FROM public.get_user_permissions('USER-UUID'::uuid);
```

---

## Related

- [RLS.md](./RLS.md)
- [TESTING.md](./TESTING.md) — tests 5, 6, 7
