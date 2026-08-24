# Testing — 16 Critical Tests

**Última actualización:** 2026-07-27

Pruebas manuales obligatorias antes de considerar el sistema listo para producción. Checklist imprimible: [scripts/critical-checks.md](../scripts/critical-checks.md).

Automatización parcial: `npm run smoke:api` (tests 1 parcial, 11, 14).

---

## Prerequisites

- Supabase configurado con migraciones + seed (opcional)
- Admin y al menos un usuario Recepción (sin finanzas)
- `.env.local` completo
- `npm run dev` en marcha

---

## Test 1 — Landing POST creates request, NOT reservation

**Objetivo:** Confirmar WEB_REQUEST ≠ RESERVATION.

### Steps

1. Ejecute POST a `/api/public/requests` (curl o `npm run smoke:api`).
2. Anote el `requestCode` (ej. `SOL-2026-000001`).
3. En dashboard → **Solicitudes**, verifique registro con estado **Pendiente**.
4. En **Reservas**, confirme que **no** se creó reserva automática.
5. En SQL:

```sql
SELECT code, status FROM web_requests WHERE code = 'SOL-2026-000001';
SELECT count(*) FROM reservations; -- sin incremento por el POST
```

### Expected

- `web_requests.status = 'PENDING'`
- Sin fila nueva en `reservations`

---

## Test 2 — Create quote does NOT block vehicle

**Objetivo:** Cotización no reserva inventario.

### Steps

1. Login como Recepción o Admin.
2. Cree cotización para vehículo X con fechas futuras.
3. Verifique `vehicles.status` — debe seguir `AVAILABLE` (u operativo, no `RESERVED`).
4. Intente crear otra cotización/reserva overlapping — debe ser posible a nivel cotización.

### Expected

- Cotización en estado `DRAFT` o `SENT`
- Vehículo no bloqueado hasta reserva confirmada

---

## Test 3 — Quote ACCEPTED → reservation

**Objetivo:** Flujo comercial correcto.

### Steps

1. Abra cotización existente.
2. Cambie estado a **Aceptada** (`ACCEPTED`).
3. Use acción **Convertir a reserva** (o flujo equivalente en UI).
4. Verifique código `RES-YYYY-######` generado.

### Expected

- Reserva `CONFIRMED` vinculada a quote y customer
- Vehículo puede pasar a `RESERVED` según lógica de negocio

---

## Test 4 — Overlapping reservation rejected

**Objetivo:** Anti doble-reserva.

### Steps

1. Cree reserva confirmada vehículo X: 1–5 ago 2026.
2. Intente segunda reserva mismo vehículo: 3–7 ago 2026.
3. Repita en otra pestaña simultáneamente (race) si es posible.

### Expected

- UI muestra error amigable en español
- BD rechaza con exclusion constraint (`23P01`)
- Mensaje tipo: *"Este vehículo ya tiene una reserva entre estas fechas."*

---

## Test 5 — No finance.view → finance page forbidden

**Objetivo:** RBAC en UI.

### Steps

1. Login como usuario **Recepción** (sin `finance.view`).
2. Navegue directamente a `/dashboard/finanzas`.

### Expected

- Acceso denegado (403 / redirect / mensaje de permiso)
- Sidebar no muestra sección Finanzas

---

## Test 6 — No finance permission → finance API/action forbidden

**Objetivo:** RBAC en server actions.

### Steps

1. Como Recepción, intente crear ingreso vía `/dashboard/ingresos/nuevo` o action directa.

### Expected

- Error 403 o toast *"No tiene permiso..."*
- Sin insert en `income_transactions`

---

## Test 7 — Direct finance query blocked by RLS

**Objetivo:** RLS última línea de defensa.

### Steps

1. Con sesión Recepción, abra DevTools → Application → cookies Supabase.
2. En consola del browser (cliente Supabase autenticado):

```javascript
// En página del dashboard con sesión activa
const { data, error } = await fetch('/...') // o supabase client
```

Mejor: usar Supabase SQL como ese user JWT en staging, o:

```sql
-- Como admin en SQL editor, simular:
SET request.jwt.claim.sub = 'RECEPCION-USER-UUID';
SELECT * FROM income_transactions; -- vía client SDK en browser
```

3. Cliente browser autenticado como Recepción:

```javascript
const { data } = await supabase.from('income_transactions').select('*');
console.log(data); // []
```

### Expected

- Array vacío o error policy
- **No** filas financieras visibles

---

## Test 8 — Signed contract + PDF

**Objetivo:** Contrato completo.

### Steps

1. Cree contrato desde reserva activa.
2. Firme como cliente (SignaturePad).
3. Firme representante si aplica.
4. Descargue PDF vía `/api/contracts/[id]/pdf`.

### Expected

- Firmas persistidas en `contract_signatures`
- PDF genera sin error
- Estado contrato avanza (`CLIENT_SIGNED` → `COMPLETED`)

---

## Test 9 — DamageMap2D persists normalized coordinates

**Objetivo:** Coordenadas 0.0–1.0 sobreviven reload.

### Steps

1. Cree inspección CHECK_OUT.
2. Agregue marca de daño en DamageMap2D.
3. Guarde y recargue página.

### Expected

- Marca en **misma posición relativa** al siluetado
- Valores `x`, `y` entre 0 y 1 en `inspection_damage_marks`

---

## Test 10 — CHECK_OUT + CHECK_IN comparison

**Objetivo:** Comparador de inspecciones.

### Steps

1. Complete inspección CHECK_OUT para contrato/reserva.
2. Cree inspección CHECK_IN.
3. Abra `/dashboard/inspecciones/[id]/comparar`.

### Expected

- Vista lado a lado CHECK_OUT vs CHECK_IN
- Daños y checklist visibles para comparación

---

## Test 11 — unpublished vehicle excluded from public API

**Objetivo:** Catálogo público filtrado.

### Steps

1. Cree vehículo con `published_on_web = false`.
2. `curl http://localhost:3000/api/public/vehicles`
3. Cambie a `published_on_web = true` y repita.

### Expected

- Vehículo **ausente** cuando unpublished
- **Presente** cuando published + active

---

## Test 12 — Archive vehicle removes from operations

**Objetivo:** Archivo vs eliminación.

### Steps

1. Archive vehículo desde dashboard.
2. Verifique no aparece en listado operativo default.
3. Verifique historial/reservas pasadas aún referencian el vehículo.

### Expected

- `archived_at` set
- Excluido de API pública y selects operativos
- Datos históricos intactos

---

## Test 13 — Staff login and protected routes

**Objetivo:** Auth baseline.

### Steps

1. Logout completo.
2. Acceda `/dashboard` sin sesión → redirect a `/login`.
3. Login admin válido → redirect `/dashboard`.
4. Usuario `INACTIVE` → login rechazado.

### Expected

- Middleware protege rutas dashboard
- Solo staff ACTIVE accede

---

## Test 14 — Honeypot rejects bots silently

**Objetivo:** Anti-spam POST público.

### Steps

1. POST `/api/public/requests` con `"website": "http://spam.bot"`.
2. Verifique respuesta `200` con `requestCode: "OK"`.
3. Confirme **sin** nueva fila en `web_requests`.

### Expected

- Respuesta fake success
- BD sin insert

---

## Test 15 — Origin validation on public POST

**Objetivo:** CORS / Origin allowlist.

### Steps

1. POST sin header `Origin` → `403 FORBIDDEN`.
2. POST con `Origin: https://evil.com` → `403`.
3. POST con `Origin` en `LANDING_ALLOWED_ORIGIN` → `201`.

### Expected

- Solo orígenes configurados aceptados

---

## Test 16 — Build and typecheck pass

**Objetivo:** Calidad de release.

### Steps

```bash
npm run typecheck
npm run lint
npm run build
```

### Expected

- Exit code 0 en los tres comandos
- Sin errores TypeScript bloqueantes

---

## Quick automation

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run smoke:api
```

El smoke script cubre conectividad GET vehicles, POST válido y honeypot. Los tests 2–10 y 13 requieren verificación manual en UI.

---

## Related

- [scripts/critical-checks.md](../scripts/critical-checks.md)
- [API.md](./API.md)
- [RBAC.md](./RBAC.md)
- [RLS.md](./RLS.md)
