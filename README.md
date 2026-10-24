# Noti 0.5.1
PWA (HTML + CSS + JS puro, Supabase, GitHub Pages). Despliegue en este orden:
1. Supabase → SQL Editor: ejecutar `SUPABASE_MIGRACION_0.4.0.sql` (si aún no), luego `SUPABASE_MIGRACION_0.5.0.sql` y luego `SUPABASE_MIGRACION_0.5.1.sql`. Revisar las consultas de verificación al final de cada una. **Ejecutar la 0.5.1 antes de subir la app**: sin la tabla `activities` la app avisa de migración pendiente y trabaja en local.
2. Subir todos los archivos al repositorio. El Service Worker `noti-0.5.1` limpia cachés viejos y recarga una vez.
3. Pruebas: ver `tests/README`. Producción = los mismos archivos estáticos (no hay compilación).
Detalles, riesgos y pendientes: `CAMBIOS_0.5.1.md`.
