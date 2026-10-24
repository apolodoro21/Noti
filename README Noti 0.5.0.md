# Noti 0.5.0

PWA de organización personal (HTML + CSS + JS puro, Supabase, GitHub Pages). Evolución directa de Noti 3.0 (que en la nueva numeración equivale a la 0.3.x).

## Novedades de la 0.5.0

> Resumen corto. El detalle completo está en [`CAMBIOS_0.5.0.md`](CAMBIOS_0.5.0.md).

- _(Escribe aquí 3 a 5 cambios principales de esta versión, copiados de `CAMBIOS_0.5.0.md`.)_
- _(Ejemplo: nueva función X, corrección de Y, mejora de Z.)_

## Despliegue (en este orden)

1. **Supabase → SQL Editor:** pega y ejecuta `SUPABASE_MIGRACION_0.5.0.sql` (una sola vez; es idempotente y *aditiva*: no toca `notes`, `drawings`, `schedules` ni `profiles`). Después ejecuta las consultas de verificación del final del archivo.
2. **Sube todos los archivos** de esta carpeta a tu repositorio de GitHub Pages (reemplazando los de la versión anterior). No hace falta borrar nada a mano.
3. **Abre la app.** El Service Worker nuevo (`noti-0.5.0`) borra los cachés viejos y recarga una vez. Si algún dispositivo se resiste, cierra y reabre la PWA.

Si subes la app **antes** de ejecutar el SQL, funciona igualmente en modo local y muestra un aviso; al ejecutar el SQL sube todo lo pendiente por sí sola (sin perder nada).

> Si vienes de una versión anterior a la 0.4.0, ejecuta también `SUPABASE_MIGRACION_0.4.0.sql` antes de la 0.5.0 (y los anteriores en orden si aplica).

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Estilos |
| `app.js` | Lógica de la interfaz y conexión con Supabase |
| `noti-core.js` | Núcleo de lógica (fechas, calendario, recurrencia), probado aparte |
| `sw.js` | Service Worker (caché y modo sin conexión) |
| `manifest.webmanifest` | Configuración de la PWA |
| `icons/` | Íconos de la app |
| `SUPABASE_MIGRACION_0.5.0.sql` | Migración vigente de la base de datos |
| `SUPABASE_MIGRACION_0.4.0.sql`, `SUPABASE_MIGRACION.sql`, `SUPABASE_USERNAME.sql` | Migraciones anteriores (histórico) |
| `CAMBIOS_0.5.0.md`, `CAMBIOS_0.4.0.md`, `NOTI_3.0_CAMBIOS.md` | Registro de cambios por versión |

## Pruebas automáticas (opcional)

`node tests/test_core.js` (lógica) y `python3 tests/test_ui.py` / `test_ui2.py` (Playwright + Supabase simulado; ver `tests/README`).

<!-- Si no vas a subir la carpeta tests/, borra esta sección completa. -->

## Historial de versiones

| Versión | Notas |
|---|---|
| 0.5.0 | Ver [`CAMBIOS_0.5.0.md`](CAMBIOS_0.5.0.md) |
| 0.4.0 | Ver [`CAMBIOS_0.4.0.md`](CAMBIOS_0.4.0.md) |
| 0.3.x (antes "3.0") | Ver [`NOTI_3.0_CAMBIOS.md`](NOTI_3.0_CAMBIOS.md) |
