# Servicios externos — OLDES Rent-a-Car

**Última actualización:** 2026-07-27  
**Arquitectura oficial:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Mapa de responsabilidades

| Servicio | Responsabilidad | Estado típico |
|----------|-----------------|---------------|
| **Supabase** | Datos + Auth + RLS | **PENDIENTE DE CONFIGURACIÓN EXTERNA** |
| **Cloudinary** | Fotos públicas de vehículos | **PENDIENTE DE CONFIGURACIÓN EXTERNA** |
| **Cloudflare R2** | PDF, firmas, inspecciones, docs privados | **PENDIENTE DE CONFIGURACIÓN EXTERNA** |
| **Vercel** | Hosting Next.js (Landing + Admin + APIs) | **PENDIENTE DE CONFIGURACIÓN EXTERNA** |
| **Resend** | Email transaccional | Opcional — degradación graceful |
| **GitHub** | Repositorio | Opcional |

Sin inventar credenciales. El código funciona con fallbacks seguros cuando falta un servicio.

---

## 1. Supabase — cerebro

1. Crear proyecto en [supabase.com](https://supabase.com).  
2. Copiar URL, anon key, service role key a `.env.local`.  
3. Aplicar migraciones (`supabase/migrations/`).  
4. Crear primer admin (`supabase/seed/create_first_admin.sql`).  

Guía: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

**No** usar Supabase Storage como destino definitivo de archivos pesados en producción. Preferir R2.

---

## 2. Cloudinary — fotos comerciales

1. Crear cuenta / cloud.  
2. Completar:

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Uso: galería de vehículos, portadas, imágenes de Landing.

---

## 3. Cloudflare R2 — bodega privada

1. En Cloudflare → R2 → Create bucket (ej. `oldes-private`).  
2. Create API token con permisos Object Read & Write.  
3. Completar:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=oldes-private
```

Estructura de keys sugerida:

```
contracts/{id}/...
quotes/{id}/...
signatures/{id}/...
inspections/{id}/...
receipts/{id}/...
documents/{id}/...
```

Acceso vía **signed URLs** (expiración), nunca URLs públicas permanentes.

Si R2 no está configurado, el código puede usar Supabase Storage temporalmente o data URL en desarrollo (con warning).

---

## 4. Vercel + dominios

Estructura preferida:

| Host | App |
|------|-----|
| `oldesrentacar.com` | Landing pública |
| `app.oldesrentacar.com` | Sistema admin + APIs |

Opciones de despliegue:

**A — Un solo proyecto Next.js (recomendada al inicio)**  
- Domains: `app.oldesrentacar.com` → app  
- Landing en `oldesrentacar.com` puede ser:
  - misma app sirviendo `/` o `/landing`, **o**
  - sitio estático aparte que llama a `https://app.oldesrentacar.com/api/public/*`

**B — Dos proyectos Vercel**  
- Proyecto `landing` → `oldesrentacar.com`  
- Proyecto `admin` → `app.oldesrentacar.com`  
- Misma BD / mismos secrets de datos  

`LANDING_ALLOWED_ORIGIN=https://oldesrentacar.com`  
`NEXT_PUBLIC_APP_URL=https://app.oldesrentacar.com`  
`NEXT_PUBLIC_LANDING_URL=https://oldesrentacar.com`

---

## 5. Resend

```
RESEND_API_KEY=
EMAIL_FROM=OLDES Rent-a-Car <noreply@oldesrentacar.com>
```

Sin API key: la app muestra “Servicio de correo no configurado.” y no se rompe.

---

## Checklist de go-live

- [ ] Supabase prod + migraciones + admin  
- [ ] Cloudinary  
- [ ] Cloudflare R2 bucket + API token  
- [ ] Vercel env vars  
- [ ] Dominios DNS (`oldesrentacar.com` + `app.oldesrentacar.com`)  
- [ ] `LANDING_ALLOWED_ORIGIN` apunta a la Landing  
- [ ] Landing `apiBase` apunta a `https://app.oldesrentacar.com`  
- [ ] Probar solicitud PENDING + login admin  
