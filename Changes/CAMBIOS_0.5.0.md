# Noti 0.5.0 — cambios, seguridad y pendientes
Construido sobre 0.4.0 (mismo stack: HTML/CSS/JS puro + Supabase). No se tocan `notes`, `drawings`, `schedules`.

## Despliegue
1. Supabase → SQL Editor: ejecutar `SUPABASE_MIGRACION_0.4.0.sql` (si no se hizo) y luego `SUPABASE_MIGRACION_0.5.0.sql`. Revisar las consultas de verificación del final.
2. Subir todos los archivos al repositorio (GitHub Pages). El SW `noti-0.5.0` limpia cachés y recarga una vez.
3. Pruebas: `node tests/test_core.js && node tests/test_import_0_5.js`; UI: `python3 tests/test_ui.py && python3 tests/test_ui2.py` (ver tests/README).

## Implementado
- **Importación 3.0 (módulo 4):** identidad estable `note:<día>` / `drawing:<día>` (las tablas antiguas tienen PK `(user_id, day_of_week)`). Estados `imported`/`skipped` en `profiles.settings.legacyImport`, guardados con `noti_merge_settings` (merge atómico en una sentencia; la primera decisión de cada clave se conserva; no pisa preferencias ni otros dispositivos). La marca viaja en la cola **después** de la op de nota/dibujo: si el guardado falla no se envía. Botón «No importar».
- **Preferencias:** `saveCloudPreferences` ya no reemplaza todo `settings` (bug de 0.4 que habría borrado las decisiones).
- **Login por usuario o correo (módulo 8):** `iniciarSesion`, `registrar`, campo «Nombre de usuario», `profiles.username` único (índice sobre `lower()`), formato `^[A-Za-z0-9_.-]{3,20}$`, trigger que crea el perfil en la misma transacción que la cuenta (sin fallo parcial), `email_por_usuario`, saludo «Hola, Apolo» (prioridad: `profiles.username` → metadata → display_name → correo). `apolo` asignado a apolodoro19@gmail.com; **mruizn23@gmail.com queda pendiente** de que confirmes el usuario.
- **Calendario:** sin botón «Abrir día»: 1.er toque selecciona, 2.º sobre la misma fecha abre (ratón, táctil, Enter/Espacio). La píldora de «Horario» muestra la próxima clase en vez de contar bloques.
- **Apariencia:** «Gris tenue», paletas Coral, Eléctrico y Blanco (blanco usa acento oscuro sobre tema claro), «Temas de App» (Cuadrado, Bordes suaves = 0.4, Glass con fallback sin `backdrop-filter`, Bold), todo por variables/`data-style`; persistido en `settings`. Microinteracciones: presión de botones, fundido al abrir nota, pulso en «Guardando…», `prefers-reduced-motion` respetado.

## Riesgos de seguridad
`email_por_usuario` (SECURITY DEFINER, `search_path` fijo, solo coincidencia exacta, valida formato, `pg_sleep(0.2)`, ejecutable por `anon` porque el login lo exige) **permite enumerar usuarios y obtener su correo** probando nombres. Mitigaciones reales: Rate limits de Auth/API de Supabase, WAF/Turnstile o una Edge Function que haga login sin devolver el correo (alternativa más segura, no implementada). «Contraseña incorrecta» solo se muestra en login por usuario (la existencia ya es conocida); por correo el mensaje sigue siendo genérico. `email rate limit exceeded` sin SMTP propio puede impedir completar registros en pruebas; no se tocó la configuración de correo.

## PENDIENTE (no implementado)
Módulo 1 (Hoja del Día simplificada, separar clases/actividades con tabla de tareas sin hora, descripción y estado completado, botón «+» con menú), módulo 2 (panel «Próximas actividades»; solo está la constante `UPCOMING_DAYS=7`), módulo 3 (paneles notas/dibujo mutuamente excluyentes y desplegables), animaciones de estados guardado/sincronizado/error con reintento, y pruebas de importación contra Supabase real (casos 5, 6, 8, 10). Necesita: modelo `activities` (migración + RLS + cola de sincronización) y reestructurar `#workspace`.
## Pruebas (reales, entorno simulado)
test_core 43/43 · test_import_0_5 8/8 (lógica pura) · test_ui 62/62 y test_ui2 ver línea final del informe · **NO ejecutado:** SQL contra Postgres real, login real por usuario, RLS real, contraste medido, cuatro estilos en dispositivo real (solo revisión de CSS).
