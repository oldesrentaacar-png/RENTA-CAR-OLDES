# Public API — Rent A Car Pro

Base URL: `{NEXT_PUBLIC_APP_URL}` (ej. `http://localhost:3000` o `https://app.ejemplo.com`)

Formato de respuesta estándar:

```typescript
// Éxito
{ "success": true, "data": T }

// Error
{ "success": false, "error": { "message": string, "code"?: string, "details"?: unknown } }
```

---

## GET `/api/public/vehicles`

Lista el catálogo público de vehículos.

### Auth

Ninguna. Rate limit: **60 req/min** por IP.

### Filtros aplicados (server-side)

- `published_on_web = true`
- `is_active = true`
- `deleted_at IS NULL`
- `archived_at IS NULL`

### Request

```http
GET /api/public/vehicles HTTP/1.1
Host: localhost:3000
```

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "toyota-corolla-2024",
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2024,
      "category": "SEDAN",
      "transmission": "AUTOMATIC",
      "passengers": 5,
      "luggage": 2,
      "airConditioning": true,
      "dailyRate": 45.0,
      "publicDescription": "Sedán económico ideal para ciudad.",
      "images": [
        {
          "url": "https://res.cloudinary.com/example/image/upload/v1/vehicles/abc.jpg",
          "isPrimary": true,
          "position": 0
        }
      ]
    }
  ]
}
```

### Error responses

| Status | code | Cuándo |
|--------|------|--------|
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |
| 503 | `SERVICE_UNAVAILABLE` | Supabase admin no configurado |
| 500 | `INTERNAL_ERROR` | Error de BD |

### CORS

`OPTIONS` soportado. `GET` no requiere `Origin`.

---

## POST `/api/public/requests`

Crea una solicitud web (`web_requests`). Estado inicial: **`PENDING`**. Genera código `SOL-YYYY-######`.

**No crea reserva ni bloquea vehículo.**

### Auth

Ninguna (usa service role en servidor). Rate limit: **10 req/min** por IP.

### Headers requeridos

| Header | Requerido | Notas |
|--------|-----------|-------|
| `Content-Type` | Sí | `application/json` |
| `Origin` | Sí | Debe estar en `LANDING_ALLOWED_ORIGIN` |

### Request body

```json
{
  "firstName": "María",
  "lastName": "García",
  "phone": "50371234567",
  "email": "maria@example.com",
  "pickupDate": "2026-08-10",
  "pickupTime": "08:30",
  "returnDate": "2026-08-15",
  "returnTime": "17:00",
  "vehicleId": "550e8400-e29b-41d4-a716-446655440000",
  "vehicleCategory": "SUV",
  "pickupLocation": "Aeropuerto San Miguel",
  "returnLocation": "Oficina San Antonio",
  "notes": "Necesito silla para niño",
  "website": ""
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `firstName` | string | Sí | 1–100 chars |
| `lastName` | string | Sí | 1–100 chars |
| `phone` | string | Sí | 7–20 chars |
| `email` | string | No | Email válido |
| `pickupDate` | string | Sí | `YYYY-MM-DD` |
| `pickupTime` | string | Sí | `HH:mm` |
| `returnDate` | string | Sí | `YYYY-MM-DD` |
| `returnTime` | string | Sí | `HH:mm` |
| `vehicleId` | uuid | No | UUID válido |
| `vehicleCategory` | string | No | max 100 |
| `pickupLocation` | string | No | max 255 |
| `returnLocation` | string | No | max 255 |
| `notes` | string | No | max 2000 |
| `website` | string | No | **Honeypot** — debe estar vacío |

`returnDate`/`returnTime` debe ser posterior a pickup.

### Response `201`

```json
{
  "success": true,
  "data": {
    "requestCode": "SOL-2026-000042"
  }
}
```

### Honeypot behavior

Si `website` tiene contenido, la API responde `200` con `{ "requestCode": "OK" }` **sin insertar** en BD (anti-bot).

### Error responses

| Status | code | Cuándo |
|--------|------|--------|
| 400 | `BAD_REQUEST` | JSON inválido |
| 400 | `VALIDATION_ERROR` | Campos inválidos (`details` con Zod flatten) |
| 403 | `FORBIDDEN` | Origin no autorizado |
| 429 | `RATE_LIMITED` | Rate limit |
| 503 | `SERVICE_UNAVAILABLE` | Supabase no configurado |
| 500 | `INTERNAL_ERROR` | Fallo al insertar |

### CORS

Preflight `OPTIONS` devuelve headers CORS si Origin es válido.

---

## Protected API routes (staff only)

No documentadas como API pública. Requieren sesión Supabase:

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/contracts/[id]/pdf` | `contracts.view` |
| GET | `/api/quotes/[id]/pdf` | `quotes.view` |

---

## Examples

### curl — list vehicles

```bash
curl -s "$APP_URL/api/public/vehicles"
```

### curl — create request

```bash
curl -s -X POST "$APP_URL/api/public/requests" \
  -H "Content-Type: application/json" \
  -H "Origin: $LANDING_ORIGIN" \
  -d @- <<'EOF'
{
  "firstName": "Test",
  "lastName": "User",
  "phone": "50370000000",
  "pickupDate": "2026-09-01",
  "pickupTime": "10:00",
  "returnDate": "2026-09-03",
  "returnTime": "10:00",
  "website": ""
}
EOF
```

### Smoke script

```bash
npm run smoke:api
```

Ver [TESTING.md](./TESTING.md) para pruebas manuales.
