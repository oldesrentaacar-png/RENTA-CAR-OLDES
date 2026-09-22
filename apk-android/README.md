# OLDES Sistema — APK Android (WebView + alertas)

Aplicación Android que abre el sistema web de **OLDES Rent a Car** a pantalla completa, con descargas, subida de archivos y **notificaciones nativas de alertas** aunque el teléfono esté bloqueado.

- **Paquete:** `com.oldes.rentacar.app`
- **Nombre:** OLDES Sistema
- **Versión:** 1.1.0
- **URL:** https://oldescarrentalelsalvador.com/login

## Qué hace la v1.1

| Función | Detalle |
|---------|---------|
| WebView completo | Login, dashboard, contratos, inspecciones, PDFs |
| Subir fotos/archivos | Cámara y galería desde inspecciones |
| Descargar PDFs | A carpeta Descargas del teléfono |
| Alertas nativas | Notificación cuando hay alerta nueva (entrega, devolución, contrato vencido, mantenimiento) |
| Segundo plano | Servicio en primer plano + consulta cada 3 min mientras está logueado |
| Respaldo | WorkManager cada 15 min aunque la app esté cerrada (requiere sesión activa) |
| WhatsApp / tel | Se abren en apps externas |

## Requisito en el servidor

La APK consulta:

`GET /api/mobile/alerts/summary`

(con la misma sesión/cookies del login). **Debe estar desplegado en producción** junto con el commit que incluye esa ruta.

## Generar APK

### Android Studio

1. Abrir carpeta `apk-android`
2. **Build → Build APK(s)**
3. APK: `app/build/outputs/apk/debug/app-debug.apk`

### Línea de comandos (PowerShell)

```powershell
$env:ANDROID_HOME = "D:\Androi\SDK"
$env:GRADLE_USER_HOME = "D:\CURSOR\gradle-home"
$env:TEMP = "D:\CURSOR\tmp-agent"
$env:TMP = "D:\CURSOR\tmp-agent"
cd "D:\CURSOR\PROYECTO RENTA CAR\apk-android"
.\gradlew.bat assembleDebug
Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "D:\DESCARGAS\OLDES_Sistema.apk" -Force
```

## Instalación en el teléfono

1. Copiar `OLDES_Sistema.apk` al teléfono.
2. Permitir **Instalar apps desconocidas** para el origen (Archivos / Chrome).
3. Instalar.
4. Al abrir, aceptar **Notificaciones**.
5. Iniciar sesión → al entrar al dashboard empieza el monitoreo de alertas.

## Notificaciones — cómo funcionan

1. Tras login, la app detecta `/dashboard` y activa monitoreo.
2. Cada **3 minutos** (app minimizada o pantalla bloqueada) consulta alertas.
3. Si hay alerta **nueva**, muestra notificación con sonido/vibración.
4. Al tocar la notificación abre **Alertas** en la app.
5. Al cerrar sesión se detiene el monitoreo.

> **Nota:** Android muestra una notificación discreta “OLDES Sistema activo” mientras monitorea en segundo plano (obligatorio del sistema). Las alertas importantes van en canal aparte con prioridad alta.

## Dominios permitidos en la app

- `oldescarrentalelsalvador.com`
- `oldesrentacar.com` / `app.oldesrentacar.com`
- `renta-car-oldes.vercel.app`
