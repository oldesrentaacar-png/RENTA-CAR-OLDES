# Deployment — OLDES Rent-a-Car (Vercel)

**Última actualización:** 2026-07-27  
**Arquitectura:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Dominios oficiales (preferidos)

| Dominio | Uso |
|---------|-----|
| `https://oldesrentacar.com` | Landing pública |
| `https://app.oldesrentacar.com` | Sistema administrativo + APIs |
| `https://app.oldesrentacar.com/login` | Acceso staff |
| `https://app.oldesrentacar.com/dashboard` | Panel privado |
| `https://app.oldesrentacar.com/api/public/*` | APIs para la Landing |

DNS (Cloudflare o registrador):

- `A` / `CNAME` `oldesrentacar.com` → Vercel (Landing o rewrite)
- `CNAME` `app` → Vercel (proyecto admin)

---

## Prerequisites

1. Proyecto Supabase producción + migraciones  
2. Primer administrador  
3. Cloudinary (fotos vehículos)  
4. Cloudflare R2 (archivos privados)  
5. Repositorio en GitHub → Vercel  

---

## Variables de entorno (Vercel)

| Variable | Requerida | Notas |
|----------|:---------:|-------|
| `NEXT_PUBLIC_APP_URL` | ✓ | `https://app.oldesrentacar.com` |
| `NEXT_PUBLIC_LANDING_URL` | ○ | `https://oldesrentacar.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Secret |
| `LANDING_ALLOWED_ORIGIN` | ✓ | `https://oldesrentacar.com` |
| `CLOUDINARY_CLOUD_NAME` | ○* | Fotos públicas |
| `CLOUDINARY_API_KEY` | ○* | |
| `CLOUDINARY_API_SECRET` | ○* | Secret |
| `R2_ACCOUNT_ID` | ○* | Archivos privados |
| `R2_ACCESS_KEY_ID` | ○* | Secret |
| `R2_SECRET_ACCESS_KEY` | ○* | Secret |
| `R2_BUCKET` | ○* | ej. `oldes-private` |
| `RESEND_API_KEY` | ○ | |
| `EMAIL_FROM` | ○ | |

\* Recomendado para producción. Sin ellos hay fallbacks / warnings.

---

## Supabase Auth URLs

| Campo | Valor |
|-------|-------|
| Site URL | `https://app.oldesrentacar.com` |
| Redirect URLs | `https://app.oldesrentacar.com/**`, `http://localhost:3000/**` |

Desactivar registro público de empleados.

---

## Landing → API

En el HTML de la Landing:

```js
const CFG = {
  apiBase: "https://app.oldesrentacar.com",
  // ...
};
```

Y en Vercel admin:

```
LANDING_ALLOWED_ORIGIN=https://oldesrentacar.com
```

---

## Build local antes de deploy

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Checklist post-deploy

- [ ] `https://oldesrentacar.com` carga Landing con logo OLDES  
- [ ] `https://app.oldesrentacar.com/login` abre admin  
- [ ] Login admin funciona  
- [ ] `GET /api/public/vehicles` responde  
- [ ] Formulario Landing crea `web_requests` PENDING  
- [ ] Subida de foto vehículo → Cloudinary  
- [ ] Firma / PDF → R2 (o warning si aún no está)  
