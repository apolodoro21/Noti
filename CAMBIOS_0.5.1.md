# Noti 0.5.1 — completa lo pendiente de 0.5.0
(0.5.0 ya incluía: importación única + «No importar», login por usuario/correo, doble toque, Gris tenue, 3 paletas nuevas y 4 Temas de App. Ver riesgos de `email_por_usuario` abajo.)

## Nuevo en 0.5.1
- **Actividades/tareas** separadas del horario: tabla `activities` (título, descripción, fecha límite opcional, hecha; **sin hora**), RLS por usuario, Realtime y cola de sincronización local (no se pierde nada sin red). Los bloques del horario y las tareas antiguas no se convierten entre sí.
- **Botón «+» cuadrado** (abajo a la derecha en el calendario; en la Hoja del Día va en la cabecera para no tapar contenido). Menú: «Agregar actividad o tarea» / «Agregar o modificar horario».
- **Hoja del Día simplificada:** fecha → horario → actividades → paneles. Sin estadísticas ni botones sobrantes; estados vacíos con acción de agregar. Las actividades de «hoy» incluyen también pendientes vencidas o sin fecha (marcadas «Vencida»).
- **Próximas actividades** bajo el calendario: pendientes con fecha entre hoy y hoy+`UPCOMING_DAYS` (7, constante en `app.js`), ordenadas, sin completadas ni vencidas; tocar una abre su día; se actualiza al crear/editar/completar/eliminar y por Realtime.
- **Notas y dibujo en paneles independientes:** notas abiertas, dibujo contraído; abrir uno contrae el otro (acordeón, transición suave, `aria-expanded`); las herramientas de cada uno viven dentro de su panel. El `<canvas>` y el editor no se recrean: texto, trazos y guardados pendientes se conservan (se guarda el dibujo al salir de su panel). Se eliminaron «Centrar nota» y el dock inferior, que ya no tenían sentido.
- **Estados de guardado/sincronización reales:** Guardando → Sincronizando → Sincronizado; sin red: Pendiente; fallo: «Error al sincronizar · Reintentar» (clic para reintentar). «Sincronizado» solo aparece sin operaciones en cola.
- Hover discreto en tarjetas, pulso en estados en curso, todo anulado con `prefers-reduced-motion`.
- Acento «Eléctrico» aclarado sobre «Gris tenue» (medido 4,5:1).

## Pruebas ejecutadas (Chromium headless + Supabase SIMULADO)
test_core 43/43 · test_import_0_5 8/8 · test_activities 6/6 · test_ui 63/63 · test_ui2 28/28 · test_ui3 23/23 (+, actividades sin hora, próximas, completar, doble toque, paneles, conservación de texto, error y reintento, sin errores JS). Barrido de 96 combinaciones tema×estilo×paleta (móvil 390 px): sin desbordes ni errores JS; texto ≥7:1 y texto atenuado ≥4,5:1 en todas.
Las pruebas UI antiguas se adaptaron al diseño nuevo (doble toque, paneles, estado de error en lugar de «Pendiente» cuando el servidor falla).

## NO verificado / limitaciones
- Ningún SQL (0.5.0 ni 0.5.1) se ejecutó contra un Postgres/Supabase real; RLS, RPC, trigger y Realtime reales sin probar. La simulación del RPC replica la lógica, no el motor.
- Login real por usuario y registro con confirmación de correo sin probar (límite `email rate limit exceeded` sin SMTP propio; no se tocó la configuración de correo).
- Casos de importación 8 y 10 (fallo de red a mitad; tablas antiguas intactas) solo garantizados por diseño (cola ordenada y solo lectura), sin prueba contra BD real.
- Dispositivos reales (teclado virtual, iOS/Android, dibujo táctil) sin probar; solo emulación de viewport.
- Contraste: el acento de las 5 paletas originales sobre tema **claro** mide 2,2–2,9:1 contra el panel (igual que en 0.4; se mantuvo para no alterar tus colores). Se usa en bordes/indicadores, no en texto. Si quieres, se oscurece en modo claro.
- Tras cambiar de panel hay ~0,4 s hasta que el lienzo ocupa su tamaño final.
- En «Bold» con tema oscuro los bordes negros se ven poco sobre fondo oscuro (se compensa con paneles más claros y sombra dura).
- Pendiente de decisión tuya: usuario de `mruizn23@gmail.com`.

## Seguridad (resumen)
`email_por_usuario` es SECURITY DEFINER, ejecutable sin sesión (el login lo exige): permite enumerar usuarios/correos probando nombres. Mitigado con coincidencia exacta, validación de formato, `search_path` fijo y `pg_sleep(0.2)`; para endurecer: Cloudflare Turnstile/WAF o una Edge Function de login que no devuelva el correo. `activities`: RLS `auth.uid() = user_id`, límites de longitud en BD, sin privilegios de administrador en el cliente. `noti_merge_settings`: SECURITY INVOKER (respeta RLS), solo `authenticated`.
