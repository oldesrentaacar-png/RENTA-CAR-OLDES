# OLDES Rent-a-Car — Production Setup

**Fecha:** 2026-07-27  
**Modo:** configuración real / producción

## Objetivo

Conectar servicios reales, aplicar migraciones, crear admin, probar y desplegar sin intervención manual innecesaria.

## Arquitectura (fija)

| Servicio | Uso |
|----------|-----|
| Supabase | PostgreSQL + Auth + RLS (sin archivos pesados) |
| Cloudinary | Fotos públicas vehículos |
| Cloudflare R2 | Archivos privados (PDF, firmas, inspecciones) |
| Vercel | Hosting Next.js |
| Dominios | `oldesrentacar.com` (Landing) · `app.oldesrentacar.com` (Admin) |

## Estado de credenciales

| Variable / grupo | Estado |
|------------------|--------|
| Supabase URL + anon + service_role | CONFIGURADO en `.env.local` |
| Supabase publishable/secret (nuevos) | CONFIGURADO en `.env.local` (compat) |
| `SUPABASE_DB_PASSWORD` | PENDIENTE — necesario para aplicar migraciones SQL vía CLI/pg |
| Admin email/password/nombre | PENDIENTE |
| Cloudinary | PENDIENTE |
| Cloudflare R2 | PENDIENTE |
| Resend | OPCIONAL |
| Vercel / DNS / GitHub token | PENDIENTE cuando toque deploy |

## Seguridad

- Secretos **solo** en `.env.local` y variables Vercel
- `.gitignore` incluye `.env*`
- Nunca commit de secretos
- Nunca `NEXT_PUBLIC_` para service role / R2 secret / Cloudinary secret

## Migraciones

9 archivos en `supabase/migrations/` — aplicar en orden con DB password o Supabase CLI vinculado.

## Siguiente automatización

1. Recibir DB password + admin + Cloudinary + R2 (bloque único)
2. Aplicar migraciones + seed
3. Crear administrador
4. Probar login / persistencia / APIs
5. Conectar Cloudinary + R2
6. Lint/build
7. Deploy Vercel + dominios
