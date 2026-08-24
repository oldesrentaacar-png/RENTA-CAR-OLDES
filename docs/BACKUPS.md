# Backups — Rent A Car Pro

**Última actualización:** 2026-07-27

---

## What to backup

| Asset | Criticality | Location |
|-------|-------------|----------|
| PostgreSQL database | **Critical** | Supabase |
| Private storage (contracts, signatures, inspections, receipts) | **Critical** | Supabase Storage |
| Environment variables | **Critical** | Vercel + password manager |
| Cloudinary assets | High | Cloudinary |
| Source code | High | Git remote |
| Business settings | Medium | DB table `business_settings` |

---

## Database (Supabase)

### Automatic backups (Dashboard)

Supabase Pro plans include daily backups. Ver **Database → Backups** en el Dashboard.

### Manual backup — CLI

```bash
supabase db dump -f backup-$(date +%Y%m%d).sql
```

### Manual backup — pg_dump

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  -F c -f rentacar-$(date +%Y%m%d).dump
```

Store dumps encrypted (BitLocker, S3 with SSE, etc.).

### Restore test

Periódicamente restaure en proyecto **staging** y verifique:

- Login admin
- Conteo de vehículos/reservas
- `has_permission` funciona

---

## Storage (Supabase private buckets)

Buckets: `contracts`, `signatures`, `inspections`, `receipts`.

### Export options

1. **Supabase Dashboard** — descarga manual por archivo (pocos archivos).
2. **Script** — list objects via service role + download (automatizar mensualmente).
3. **Supabase backup** — incluido según plan.

Recomendación: script mensual a almacenamiento externo cifrado.

---

## Cloudinary

- Dashboard → Media Library → export o API bulk download.
- Documentar `public_id` en tabla `vehicle_images` facilita re-sync.
- Rotar API keys si hubo exposición en Landing legacy.

---

## Configuration backup

### `.env.example` (in repo)

Plantilla sin secretos — mantener actualizada con el código.

### Vercel env vars

Export manual desde Project Settings o documentar en password manager corporativo:

- Supabase URL + keys
- Cloudinary
- Resend
- `LANDING_ALLOWED_ORIGIN`

### Supabase config

Documentar en runbook interno:

- Project ref
- Region
- Auth providers enabled
- Redirect URLs
- RLS enabled confirmation

---

## Backup schedule (recommended)

| Frequency | Action |
|-----------|--------|
| Daily | Supabase automated DB backup (plan Pro) |
| Weekly | Verify backup exists + alert if missing |
| Monthly | Manual pg_dump + storage export |
| On deploy | Tag Git release |
| On schema change | Extra dump pre-migration |

---

## Disaster recovery

1. Crear nuevo proyecto Supabase (o restore from backup).
2. Aplicar migraciones si restore parcial: `supabase db push`.
3. Restaurar storage files a buckets.
4. Actualizar Vercel env vars con nuevo project ref si cambió.
5. Re-crear admin si auth.users no restaurado.
6. Smoke test: [TESTING.md](./TESTING.md) + `npm run smoke:api`.

---

## Retention

| Type | Suggested retention |
|------|---------------------|
| Daily DB | 7–30 days |
| Monthly archives | 12 months |
| Audit logs | Según política legal del negocio |

---

## Related

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [EXTERNAL_SERVICES.md](./EXTERNAL_SERVICES.md)
