# Noti 0.4.0 — cambios, verificación y pendientes

**Numeración:** 3.0/3.02 se interpreta como 0.3.x; una actualización con funciones nuevas es el siguiente salto menor → **0.4.0**. Actualizado en: insignia visible, `APP_VERSION`, `?v=` de scripts/estilos, `sw.js` (caché `noti-0.4.0`, borra `noti-v2`, `noti-v3-2`…, `sw.js?v=` y recarga única al cambiar de versión). El SW ahora es *red primero*: con conexión nunca sirve archivos viejos.

## Qué se hizo
- **Calendario real** (6×7, lunes primero, días vecinos atenuados, hoy resaltado, navegación de mes/año, botón Hoy, indicadores nota/dibujo/horario). Fechas locales `YYYY-MM-DD` (nunca UTC); "hoy" avanza solo a medianoche local.
- **SEMANA / FIN DE SEMANA** conservadas: rótulos sobre el calendario y línea divisoria entre vie y sáb; subtítulo distinto para fin de semana (comportamiento de 3.0).
- **Espacio diario**: zoom desde la celda pulsada, fondo desenfocado y atenuado, botón fijo "Calendario" (también Esc y el botón Atrás del móvil), navegación día anterior/siguiente sin recargar, respeta `prefers-reduced-motion` y el teclado virtual (`visualViewport`).
- **Nota flotante + lienzo**: modos Escribir/Dibujar, "centrar nota", mismas herramientas de 3.0 (tipografías, tamaño, negrita, resaltador, tachado, checklist; lápiz, borrador, color, grosor, limpiar).
- **Datos por fecha**: tablas nuevas `notes_by_date`, `drawings_by_date` (clave `(user_id, fecha)`, sin duplicados). Cola local de sincronización: si falla la red nada se pierde y se reenvía solo.
- **Horarios**: series semanales (uno o varios días, inicio y fin opcional), actividades de fecha única, editar/eliminar **solo esta fecha / esta y siguientes / toda la serie**. Las recurrencias se calculan, no se duplican registros. Tablas `schedule_items` + `schedule_exceptions`.
- **Datos de 3.0 conservados:** los horarios se copian como series semanales (SQL + red de seguridad en la app, idempotente). Las notas/dibujos por día de la semana **no se asignan automáticamente a una fecha** (sería adivinar): en cada fecha vacía aparece "Importar nota/dibujo de Noti 3.0 del lunes" y el usuario decide. Nada se borra.

## Errores de 3.0 detectados y corregidos
Checklist no guardaba el estado marcado · lienzo con fondo negro fijo y trazo invisible en modo claro · una recarga en tiempo real pisaba lo que se escribía · el tamaño de texto dejaba de funcionar tras usar el resaltador · fallo de nube dejaba la app inaccesible aunque hubiera copia local · `</o>` mal cerrado en el HTML.

## Funciones de 3.0 conservadas
Login/registro y sesión · preferencias (idioma ES/EN, claro/oscuro, 5 paletas, en `profiles.settings` y local) · Realtime · botón instalar PWA · todas las herramientas del editor y del lienzo · aislamiento por usuario (RLS `auth.uid() = user_id`, sin desactivar nada).

## Informe de pruebas (entorno: Chromium headless + Supabase **simulado** en memoria)
| Resultado | Qué |
|---|---|
| **PASS 43/43** (×3 zonas horarias) | Cuadrícula de meses, bisiestos (2024/2025/2100/2000), cambio de año, "hoy" a las 23:59 local, recurrencia, inicio/fin inclusivos, excepciones, división de series |
| **PASS 62/62** | Calendario, abrir/cerrar sin perder datos, notas independientes en 2 fechas, dibujo/borrador/guardar/reabrir, alternar escribir↔dibujar, centrar sin borrar lienzo, todas las herramientas de texto, checklist, importación 3.0, 3 tipos de horario, editar/eliminar por alcance, validaciones, recarga, **segundo dispositivo sin caché** |
| **PASS 28/28** | Sin conexión → cola → reconexión; cierre con cola pendiente; tablas sin migrar (aviso + recuperación al migrar); Realtime sin pisar escritura; medianoche; caché/versionado del SW y arranque offline; modo claro/oscuro; móvil 390 px, tableta 820 px; reducción de movimiento |
| **PENDIENTE (no pude ejecutarlo)** | **El SQL contra un Postgres/Supabase real** (no hay acceso; escrito con cuidado pero no ejecutado — revisa las consultas de verificación) · RLS y Realtime reales · sincronización real entre dos dispositivos físicos · teclado virtual real, iOS/Safari y Android (solo emulación de viewport) · rendimiento con meses de datos |

## Pendiente para el propietario
1. Ejecutar el SQL y las consultas de verificación (arriba, paso 1 del README).
2. Probar en tu teléfono real: teclado virtual, dibujo táctil, instalar PWA.
3. Cada usuario importa sus notas/dibujos 3.0 en las fechas que quiera (botón en la fecha).

## Limitaciones conocidas
- El lienzo es una superficie fija 4:3 (1600×1200) para que el dibujo sea idéntico en cualquier pantalla; en móvil vertical es más baja. Los dibujos 3.0 se importan centrados (sin deformar) y su fondo oscuro se vuelve transparente; los trazos casi blancos de 3.0 se ven poco en modo claro.
- Un trazo hecho con tinta clara no cambia de color al cambiar de tema.
- En una modificación de "solo esta fecha" no se puede *vaciar* una hora (queda la de la serie).
- Los DELETE en tiempo real no llegan filtrados por usuario en Supabase; se recuperan al volver a la app (refresco al enfocar).
- Los dibujos se guardan en `localStorage` (cuota ~5 MB); si se llena, el aviso indica que ese dibujo vive solo en la nube.
- Preexistente en 3.0, sin cambiar: el SDK de Supabase viene de un CDN que el Service Worker no cachea, así que el *arranque en frío sin red* depende de que el navegador lo tenga en caché HTTP. Recomendado a futuro: alojar `supabase-js` en el repositorio.
