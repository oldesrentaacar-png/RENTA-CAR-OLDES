# OLDES Rent-a-Car

Sistema web de **OLDES Rent-a-Car**: Landing pública + panel administrativo privado.

**Arquitectura oficial:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

| Dominio | Uso |
|---------|-----|
| `oldesrentacar.com` | Landing comercial |
| `app.oldesrentacar.com` | Sistema administrativo |

---

## Stack

| Capa | Tecnología | Rol |
|------|------------|-----|
| App | Next.js 16 + React 19 + TypeScript | Landing + Admin + APIs |
| Deploy | Vercel | Hosting |
| Datos / Auth | Supabase PostgreSQL + Auth + RLS | Cerebro |
| Fotos públicas | Cloudinary | Galería vehículos / Landing |
| Archivos privados | Cloudflare R2 | PDF, firmas, inspecciones |
| Email | Resend (opcional) | Cotizaciones / avisos |

Convención: **código y BD en inglés**, **UI en español**.

---

## Quick start

### 1. Instalar dependencias

```bash
cd "D:\CURSOR\PROYECTO RENTA CAR"
npm install
```

### 2. Variables de entorno

Copie `.env.example` a `.env.local` y complete los valores:

```bash
cp .env.example .env.local
```

Mínimo para desarrollo local (dashboard + APIs públicas):

- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LANDING_ALLOWED_ORIGIN=http://localhost:3000` (o el origen de su Landing)

Producción: Cloudinary + Cloudflare R2. Ver [docs/EXTERNAL_SERVICES.md](./docs/EXTERNAL_SERVICES.md).

### 3. Migraciones Supabase

Aplique las migraciones en orden (CLI o SQL Editor):

```bash
supabase db push
```

Guía completa: [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)

### 4. Primer administrador

Las cuentas de staff **no** se auto-registran. Siga [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md).

### 5. Arrancar en desarrollo

```bash
npm run dev
```

- Admin: [http://localhost:3000/login](http://localhost:3000/login)
- Landing: [http://localhost:3000/landing/](http://localhost:3000/landing/)

### 6. Smoke test de APIs públicas (opcional)

```bash
npm run smoke:api
```

---

## Structure overview

```
src/
  app/
    login/                 # Auth staff
    dashboard/             # Módulos operativos (protegidos)
    api/
      public/              # Endpoints para Landing
      contracts/           # PDF protegido
      quotes/              # PDF protegido
  components/              # UI, formularios, tablas, charts
  lib/
    supabase/              # Clientes browser, server, admin
    auth/                  # Permisos RBAC
    validation/            # Esquemas Zod
    security/              # Rate limit, CORS, sanitización
    calculations/          # Finanzas, rentabilidad
    storage/               # Uploads privados Supabase
supabase/
  migrations/              # Esquema + RLS + seeds
  seed/                    # Dev seed + create_first_admin.sql
docs/                      # Documentación del proyecto
scripts/                   # Smoke tests y checklists
.env.example
```

Detalle de arquitectura: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Public API examples

Base URL local: `http://localhost:3000`

### GET `/api/public/vehicles`

Lista vehículos publicados (`published_on_web = true`, activos, no archivados).

```bash
curl -s http://localhost:3000/api/public/vehicles | jq
```

Respuesta exitosa:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "toyota-corolla-2024",
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2024,
      "category": "SEDAN",
      "dailyRate": 45.0,
      "images": [{ "url": "https://...", "isPrimary": true, "position": 0 }]
    }
  ]
}
```

Documentación completa: [docs/API.md](./docs/API.md)

### POST `/api/public/requests`

Crea una **solicitud web** (`web_requests`, estado `PENDING`). **No crea una reserva.**

Requiere header `Origin` autorizado (`LANDING_ALLOWED_ORIGIN`).

```bash
curl -s -X POST http://localhost:3000/api/public/requests \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "50371234567",
    "email": "juan@example.com",
    "pickupDate": "2026-08-01",
    "pickupTime": "09:00",
    "returnDate": "2026-08-05",
    "returnTime": "18:00",
    "vehicleCategory": "SEDAN",
    "website": ""
  }'
```

Respuesta `201`:

```json
{
  "success": true,
  "data": { "requestCode": "SOL-2026-000001" }
}
```

---

## Deployment (Vercel)

1. Conecte el repositorio en [vercel.com](https://vercel.com).
2. Framework preset: **Next.js**.
3. Configure las variables de [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
4. En Supabase, actualice **Site URL** y **Redirect URLs** con su dominio Vercel.
5. Ejecute migraciones contra el proyecto Supabase de producción.
6. Cree el primer admin en producción ([docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)).

---

## Missing credentials

El código está preparado para funcionar parcialmente sin servicios externos opcionales:

| Servicio | Sin credenciales |
|----------|------------------|
| Supabase (URL + keys) | Login, dashboard y APIs devuelven error / no disponible |
| Cloudinary | No se pueden subir fotos de vehículos |
| Resend | Cotizaciones/contratos sin envío de email (UI sigue operativa) |
| `LANDING_ALLOWED_ORIGIN` | `POST /api/public/requests` rechaza con 403 |

Estado detallado: [docs/EXTERNAL_SERVICES.md](./docs/EXTERNAL_SERVICES.md) — **PENDIENTE DE CONFIGURACIÓN EXTERNA**.

---

## Landing page

**No rediseñar ni reconstruir la Landing.** El HTML existente (`d:\DESCARGAS\RENTA-CAR-main\RENTA-CAR-main\index.html`) se conectará más adelante mediante cambios mínimos de JavaScript.

Guía de integración: [docs/LANDING_INTEGRATION.md](./docs/LANDING_INTEGRATION.md)

---

## Documentation index

| Documento | Contenido |
|-----------|-----------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Flujos, módulos, APK-ready |
| [docs/API.md](./docs/API.md) | Endpoints públicos |
| [docs/RBAC.md](./docs/RBAC.md) | Roles y permisos |
| [docs/RLS.md](./docs/RLS.md) | Políticas PostgreSQL |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Vercel + env vars |
| [docs/BACKUPS.md](./docs/BACKUPS.md) | Respaldo BD/storage/config |
| [docs/TESTING.md](./docs/TESTING.md) | 16 pruebas críticas |
| [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) | Proyecto, migraciones, admin |
| [docs/EXTERNAL_SERVICES.md](./docs/EXTERNAL_SERVICES.md) | Supabase, Cloudinary, Resend, Vercel |
| [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | Plan de fases (completado) |
| [scripts/critical-checks.md](./scripts/critical-checks.md) | Checklist imprimible |

---

## Scripts npm

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación TypeScript |
| `npm run smoke:api` | Smoke test APIs públicas |
