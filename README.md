# Noti 0.4.0

PWA de organización personal (HTML + CSS + JS puro, Supabase, GitHub Pages). Evolución directa de Noti 3.0 (que en la nueva numeración equivale a 0.3.x).

## Despliegue (en este orden)
1. **Supabase → SQL Editor:** pega y ejecuta `SUPABASE_MIGRACION_0.4.0.sql` (una sola vez; es idempotente y *aditiva*: no toca `notes`, `drawings`, `schedules` ni `profiles`). Después ejecuta las consultas de verificación del final del archivo.
2. **Sube todos los archivos** de esta carpeta a tu repositorio de GitHub Pages (reemplazando los de 3.0). No hace falta borrar nada a mano.
3. **Abre la app.** El Service Worker nuevo (`noti-0.4.0`) borra los cachés viejos y recarga una vez. Si algún dispositivo se resiste, cierra y reabre la PWA.

Si subes la app **antes** de ejecutar el SQL, funciona igualmente en modo local y muestra un aviso; al ejecutar el SQL sube todo lo pendiente por sí sola (sin perder nada).

## Archivos
`index.html`, `styles.css`, `app.js`, `noti-core.js` (fechas/calendario/recurrencia, probado aparte), `sw.js`, `manifest.webmanifest`, `icons/`, `SUPABASE_MIGRACION_0.4.0.sql`, `CAMBIOS_0.4.0.md`, `tests/`.

## Pruebas automáticas (opcional)
`node tests/test_core.js` (lógica) y `python3 tests/test_ui.py` / `test_ui2.py` (Playwright + Supabase simulado; ver `tests/README`).
