# Landing ↔ Rent A Car Pro — Integración

La landing HTML (`index.html`) consume las APIs públicas de Rent A Car Pro. **No crea reservas**; envía **solicitudes web** (`web_requests`) que el equipo gestiona desde el dashboard.

## Configuración en la landing

Al inicio del `<script>` de `index.html`:

```js
const CFG = {
  whatsapp: "50378901234",
  location: "San Antonio, San Miguel, El Salvador",
  // URL del backend Next.js (local o producción):
  apiBase: "http://localhost:3000",
};
```

| Entorno | `apiBase` ejemplo |
|---------|-------------------|
| Desarrollo local | `http://localhost:3000` |
| Producción | `https://tu-dominio.com` |

Tras desplegar, cambie solo `apiBase` en ambas copias del archivo:

- `D:\DESCARGAS\RENTA-CAR-main\RENTA-CAR-main\index.html` (original)
- `landing-reference/index.html` (copia en el repo)

## CORS — `LANDING_ALLOWED_ORIGIN`

El endpoint `POST /api/public/requests` valida el encabezado `Origin`. Configure en `.env` del proyecto Next.js:

```env
LANDING_ALLOWED_ORIGIN=https://www.tu-landing.com
```

Varios orígenes (dev + prod) separados por coma:

```env
LANDING_ALLOWED_ORIGIN=http://localhost:5500,http://127.0.0.1:5500,https://www.tu-landing.com
```

**Importante:**

- La landing debe servirse por **HTTP/HTTPS** (Live Server, nginx, Netlify, etc.). Abrir el archivo como `file://` no envía `Origin` y el POST fallará con 403.
- `GET /api/public/vehicles` no exige origen configurado; responde CORS para lectura desde cualquier origen.

## Endpoints usados

### Flota pública

```
GET ${apiBase}/api/public/vehicles
```

Respuesta (`{ success: true, data: [...] }`): vehículos publicados en web, mapeados internamente a la forma `{ nombre, categoria, precio, imagenes, ... }` que usa la UI existente.

Las categorías del filtro y la tabla de tarifas se **derivan** de los vehículos (precio mínimo por categoría).

### Solicitud desde formulario

```
POST ${apiBase}/api/public/requests
Content-Type: application/json
```

Campos enviados:

| Campo | Origen en formulario |
|-------|----------------------|
| `firstName` / `lastName` | Primer token / resto de `r-nombre` |
| `phone` | `r-tel` |
| `pickupDate`, `pickupTime` | `r-fecha-in`, `r-hora-in` |
| `returnDate`, `returnTime` | `r-fecha-out`, `r-hora-out` |
| `vehicleCategory` | `r-tipo` (opcional) |
| `vehicleId` | UUID si el usuario eligió un auto vía WhatsApp (opcional) |
| `pickupLocation` / `returnLocation` | `CFG.location` |
| `notes` | Días estimados (opcional) |
| `website` | Honeypot oculto — debe ir vacío |

Respuesta exitosa: `{ success: true, data: { requestCode: "..." } }`.

## Solicitudes ≠ reservas

| Landing (antes) | Rent A Car Pro (ahora) |
|-----------------|------------------------|
| Documento Firestore `reservas` | Fila en `web_requests` con `status: PENDING` |
| Confirmación inmediata | El equipo convierte la solicitud en reserva desde `/dashboard` |
| Toast: "Reserva enviada" | Toast: "Solicitud enviada" |

WhatsApp sigue abriéndose tras el envío como canal complementario; el mensaje dice **Solicitud**, no reserva.

## Panel admin en la landing

El overlay de administración se mantiene visualmente, pero **no usa Firebase**. Cualquier intento de login o CRUD muestra:

> Administración movida a Rent A Car Pro (/login)

Gestione vehículos, tarifas y solicitudes en el dashboard de Rent A Car Pro.

## Prueba local rápida

1. En Rent A Car Pro: `npm run dev` (puerto 3000).
2. Configure `LANDING_ALLOWED_ORIGIN` con el origen desde el que sirve la landing (p. ej. `http://127.0.0.1:5500`).
3. En la landing: `apiBase: "http://localhost:3000"`.
4. Sirva `index.html` con un servidor estático (no `file://`).
5. Verifique flota en la sección de autos y envíe el formulario de solicitud.

## Respaldo

Copia de seguridad previa a la integración: `landing-reference/backups/`.
