# Critical Checks Checklist — Rent A Car Pro

**Fecha:** _______________  
**Tester:** _______________  
**Entorno:** ☐ Local  ☐ Staging  ☐ Production

Marque ✅ cuando pase, ❌ cuando falle, ⏭ si no aplica.

---

## APIs públicas y Landing

| # | Test | ✅/❌ | Notas |
|---|------|-------|-------|
| 1 | POST solicitud crea `web_requests` PENDING, **no** reserva | | |
| 11 | Vehículo `published_on_web=false` ausente en GET `/api/public/vehicles` | | |
| 14 | Honeypot (`website` lleno) → 200 OK sin insert BD | | |
| 15 | POST sin Origin / Origin inválido → 403 | | |

**Automatizado parcial:** `npm run smoke:api`

---

## Flujo comercial

| # | Test | ✅/❌ | Notas |
|---|------|-------|-------|
| 2 | Cotización **no** bloquea vehículo | | |
| 3 | Cotización ACCEPTED → reserva `RES-…` | | |
| 4 | Reserva solapada rechazada (UI + BD) | | |
| 12 | Archivar vehículo → fuera de operación, historial OK | | |

---

## Seguridad RBAC / RLS

| # | Test | ✅/❌ | Notas |
|---|------|-------|-------|
| 5 | Sin `finance.view` → `/dashboard/finanzas` bloqueado | | |
| 6 | Sin permiso finanzas → action/API rechazada | | |
| 7 | Query directa `income_transactions` como Recepción → vacío/error RLS | | |
| 13 | Logout → `/dashboard` redirige login; INACTIVE no entra | | |

---

## Contratos e inspecciones

| # | Test | ✅/❌ | Notas |
|---|------|-------|-------|
| 8 | Contrato firmado + PDF descargable | | |
| 9 | DamageMap2D persiste coordenadas tras reload | | |
| 10 | Comparador CHECK_OUT vs CHECK_IN funciona | | |

---

## Release quality

| # | Test | ✅/❌ | Notas |
|---|------|-------|-------|
| 16 | `npm run typecheck` + `lint` + `build` exit 0 | | |

---

## Comandos útiles

```bash
npm run dev
npm run smoke:api
npm run typecheck
npm run lint
npm run build
```

---

## Sign-off

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Desarrollo | | | |
| Cliente / Negocio | | | |

Detalle completo: [docs/TESTING.md](../docs/TESTING.md)
